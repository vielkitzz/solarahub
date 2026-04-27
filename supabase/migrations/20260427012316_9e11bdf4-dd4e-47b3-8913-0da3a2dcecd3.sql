-- 1. Adicionar status "contraproposta" ao enum
ALTER TYPE transfer_status ADD VALUE IF NOT EXISTS 'contraproposta';

-- 2. Coluna proposta_pai_id para encadear rodadas
ALTER TABLE public.transferencias
  ADD COLUMN IF NOT EXISTS proposta_pai_id UUID REFERENCES public.transferencias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transferencias_proposta_pai ON public.transferencias(proposta_pai_id);

-- 3. Atualizar policy de INSERT para permitir que VENDEDOR também insira (contraproposta)
DROP POLICY IF EXISTS "Comprador cria proposta" ON public.transferencias;
CREATE POLICY "Comprador ou vendedor cria proposta"
ON public.transferencias
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM clubs WHERE id = transferencias.clube_comprador_id AND owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM clubs WHERE id = transferencias.clube_vendedor_id AND owner_id = auth.uid())
);

-- 4. Função para criar contraproposta
CREATE OR REPLACE FUNCTION public.criar_contraproposta(
  _proposta_id UUID,
  _valor NUMERIC,
  _salario NUMERIC,
  _luvas NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orig RECORD;
  nova_id UUID;
BEGIN
  SELECT * INTO orig FROM public.transferencias WHERE id = _proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta original não encontrada'; END IF;
  IF orig.status <> 'pendente' THEN RAISE EXCEPTION 'Apenas propostas pendentes podem ter contraproposta'; END IF;

  -- Apenas o vendedor (ou admin) pode contra-propor
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM clubs WHERE id = orig.clube_vendedor_id AND owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão para contra-propor';
  END IF;

  -- Marca original como contraproposta (encerrada)
  UPDATE public.transferencias SET status = 'contraproposta' WHERE id = _proposta_id;

  -- Cria nova proposta INVERTENDO comprador e vendedor (agora é a vez do comprador original aceitar)
  -- Mantém clube_comprador e clube_vendedor (semântica do jogador), mas marca quem fez a oferta
  INSERT INTO public.transferencias (
    jogador_id, clube_comprador_id, clube_vendedor_id,
    valor_ofertado, salario_ofertado, luvas, tipo,
    jogador_trocado_id, duracao_emprestimo,
    created_by, proposta_pai_id, status
  ) VALUES (
    orig.jogador_id, orig.clube_comprador_id, orig.clube_vendedor_id,
    _valor, _salario, _luvas, orig.tipo,
    orig.jogador_trocado_id, orig.duracao_emprestimo,
    auth.uid(), _proposta_id, 'pendente'
  ) RETURNING id INTO nova_id;

  RETURN nova_id;
END;
$$;

-- 5. Atualizar accept_transfer para permitir que QUEM RECEBEU aceite (independente de ser comprador ou vendedor)
-- A regra: se a última proposta foi feita pelo vendedor (contraproposta), o comprador aceita.
-- Vamos detectar pelo created_by
CREATE OR REPLACE FUNCTION public.accept_transfer(_transfer_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t RECORD;
  comprador_caixa NUMERIC;
  total_devido NUMERIC;
  is_contra BOOLEAN;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF t.status <> 'pendente' THEN RAISE EXCEPTION 'Proposta já processada'; END IF;

  is_contra := t.proposta_pai_id IS NOT NULL;

  -- Se for contraproposta (criada pelo vendedor), quem aceita é o comprador.
  -- Se for proposta normal, quem aceita é o vendedor.
  IF is_contra THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.clubs WHERE id = t.clube_comprador_id AND owner_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'Sem permissão para aceitar essa contraproposta';
    END IF;
  ELSE
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.clubs WHERE id = t.clube_vendedor_id AND owner_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'Sem permissão para aceitar essa proposta';
    END IF;
  END IF;

  total_devido := COALESCE(t.valor_ofertado, 0) + COALESCE(t.luvas, 0);

  IF total_devido > 0 THEN
    SELECT budget INTO comprador_caixa FROM public.clubs WHERE id = t.clube_comprador_id FOR UPDATE;
    IF comprador_caixa < total_devido THEN
      RAISE EXCEPTION 'Clube comprador não tem caixa suficiente (necessário: %, disponível: %)', total_devido, comprador_caixa;
    END IF;
    UPDATE public.clubs SET budget = budget - total_devido WHERE id = t.clube_comprador_id;
    UPDATE public.clubs SET budget = budget + total_devido WHERE id = t.clube_vendedor_id;
  END IF;

  IF t.tipo IN ('compra', 'emprestimo') THEN
    UPDATE public.players
      SET club_id = t.clube_comprador_id,
          salario_atual = t.salario_ofertado,
          a_venda = false
      WHERE id = t.jogador_id;
  ELSIF t.tipo = 'troca' THEN
    UPDATE public.players
      SET club_id = t.clube_comprador_id,
          salario_atual = t.salario_ofertado,
          a_venda = false
      WHERE id = t.jogador_id;
    IF t.jogador_trocado_id IS NOT NULL THEN
      UPDATE public.players
        SET club_id = t.clube_vendedor_id,
            a_venda = false
        WHERE id = t.jogador_trocado_id;
    END IF;
  END IF;

  UPDATE public.transferencias SET status = 'aceita' WHERE id = _transfer_id;

  -- Cancela outras propostas pendentes do mesmo jogador
  UPDATE public.transferencias
    SET status = 'recusada'
    WHERE jogador_id = t.jogador_id AND id <> _transfer_id AND status = 'pendente';
END;
$function$;

-- 6. Settings padrão para economia (apenas insere se não existir)
INSERT INTO public.settings (key, value)
SELECT 'economia_params', jsonb_build_object(
  'receita_base', jsonb_build_object('estadual', 4300000, 'nacional', 11500000, 'continental', 23000000, 'mundial', 45000000),
  'bilheteria_por_nivel', 500000,
  'manutencao_por_nivel_base', 300000,
  'multiplicadores_evolucao', jsonb_build_object('1', 0.8, '2', 0.95, '3', 1.1, '4', 1.2, '5', 1.3),
  'premiacao', jsonb_build_object('1', 20000000, '2', 12000000, '3', 8000000, '4', 5000000, '5_8', 3000000, '9_12', 1500000, '13_16', 750000, '17_20', 300000)
)
WHERE NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'economia_params');

-- 7. Reescrever process_season_turnover para ler settings
CREATE OR REPLACE FUNCTION public.process_season_turnover()
 RETURNS TABLE(club_id uuid, club_name text, delta numeric, novo_caixa numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD; ap RECORD; pl RECORD;
  receita_base NUMERIC; bilheteria NUMERIC; manutencao NUMERIC;
  folha NUMERIC; contratos NUMERIC; premiacao NUMERIC; total_delta NUMERIC;
  temp_atual INTEGER; nova_temp INTEGER;
  ganho_progresso NUMERIC; mult_base NUMERIC; novo_skill INTEGER;
  econ JSONB; bilh_por_nivel NUMERIC; manut_por_nivel NUMERIC;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar a virada de temporada';
  END IF;

  SELECT value INTO econ FROM public.settings WHERE key = 'economia_params' LIMIT 1;
  bilh_por_nivel := COALESCE((econ->>'bilheteria_por_nivel')::numeric, 500000);
  manut_por_nivel := COALESCE((econ->>'manutencao_por_nivel_base')::numeric, 300000);

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;
  nova_temp := temp_atual + 1;

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' LOOP
    receita_base := COALESCE((econ->'receita_base'->>c.reputacao::text)::numeric, 0);
    bilheteria := (c.nivel_estadio * bilh_por_nivel) * (c.rate / 3.0);
    manutencao := c.nivel_base * manut_por_nivel;

    -- Premiação a partir do settings
    premiacao := CASE
      WHEN c.posicao_ultima_temporada IS NULL THEN 0
      WHEN c.posicao_ultima_temporada = 1 THEN COALESCE((econ->'premiacao'->>'1')::numeric, 0)
      WHEN c.posicao_ultima_temporada = 2 THEN COALESCE((econ->'premiacao'->>'2')::numeric, 0)
      WHEN c.posicao_ultima_temporada = 3 THEN COALESCE((econ->'premiacao'->>'3')::numeric, 0)
      WHEN c.posicao_ultima_temporada = 4 THEN COALESCE((econ->'premiacao'->>'4')::numeric, 0)
      WHEN c.posicao_ultima_temporada BETWEEN 5 AND 8 THEN COALESCE((econ->'premiacao'->>'5_8')::numeric, 0)
      WHEN c.posicao_ultima_temporada BETWEEN 9 AND 12 THEN COALESCE((econ->'premiacao'->>'9_12')::numeric, 0)
      WHEN c.posicao_ultima_temporada BETWEEN 13 AND 16 THEN COALESCE((econ->'premiacao'->>'13_16')::numeric, 0)
      WHEN c.posicao_ultima_temporada BETWEEN 17 AND 20 THEN COALESCE((econ->'premiacao'->>'17_20')::numeric, 0)
      ELSE 0
    END;

    SELECT COALESCE(SUM(salario_atual), 0) INTO folha FROM public.players WHERE players.club_id = c.id;
    SELECT COALESCE(SUM(valor_anual), 0) INTO contratos FROM public.contratos_clube WHERE contratos_clube.club_id = c.id AND ativo = true;

    total_delta := receita_base + bilheteria + contratos + premiacao - manutencao - folha;
    UPDATE public.clubs SET budget = budget + total_delta WHERE id = c.id;

    mult_base := COALESCE((econ->'multiplicadores_evolucao'->>c.nivel_base::text)::numeric, 1.0);

    FOR ap IN SELECT * FROM public.academy_players WHERE academy_players.club_id = c.id LOOP
      ganho_progresso := CASE
        WHEN ap.age <= 18 THEN 15 + random() * 5
        WHEN ap.age <= 21 THEN 10 + random() * 5
        ELSE 5 + random() * 5
      END;
      ganho_progresso := ganho_progresso * mult_base;
      IF ap.development_progress < 100 THEN
        novo_skill := LEAST(ap.potential_max,
          ap.skill + ROUND(((ap.potential_max - ap.skill) * (ganho_progresso / 100.0)))::INTEGER);
        UPDATE public.academy_players
          SET development_progress = LEAST(100, ap.development_progress + ganho_progresso),
              skill = novo_skill,
              seasons_in_academy = ap.seasons_in_academy + 1,
              age = ap.age + 1
          WHERE id = ap.id;
      END IF;
    END LOOP;

    FOR pl IN SELECT * FROM public.players WHERE players.club_id = c.id LOOP
      IF pl.age IS NOT NULL AND pl.habilidade IS NOT NULL AND pl.potential_max IS NOT NULL THEN
        IF pl.age >= 31 THEN
          novo_skill := GREATEST(45, pl.habilidade - (1 + floor(random() * 3))::INTEGER);
        ELSIF pl.age <= 27 AND pl.habilidade < pl.potential_max THEN
          novo_skill := LEAST(pl.potential_max, pl.habilidade + (1 + floor(random() * 3))::INTEGER);
        ELSE
          novo_skill := pl.habilidade;
        END IF;
        UPDATE public.players SET habilidade = novo_skill, age = pl.age + 1 WHERE id = pl.id;
      END IF;
    END LOOP;

    club_id := c.id; club_name := c.name; delta := total_delta; novo_caixa := c.budget + total_delta;
    RETURN NEXT;
  END LOOP;

  UPDATE public.clubs SET academy_scouting_count = 0;
  UPDATE public.players SET club_id = NULL, a_venda = false
    WHERE contrato_ate IS NOT NULL AND contrato_ate <= temp_atual;
  UPDATE public.settings SET value = jsonb_build_object('ano', nova_temp) WHERE key = 'temporada_atual';
END;
$function$;

-- 8. Função preview_season_turnover (NÃO aplica, só calcula)
CREATE OR REPLACE FUNCTION public.preview_season_turnover()
 RETURNS TABLE(
   club_id uuid, club_name text, reputacao text,
   receita_base numeric, bilheteria numeric, contratos numeric, premiacao numeric,
   manutencao numeric, folha numeric, delta numeric, novo_caixa numeric
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD; econ JSONB;
  rb NUMERIC; bilh NUMERIC; manut NUMERIC; flh NUMERIC; ctr NUMERIC; prem NUMERIC;
  bilh_por_nivel NUMERIC; manut_por_nivel NUMERIC;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem ver a prévia';
  END IF;
  SELECT value INTO econ FROM public.settings WHERE key = 'economia_params' LIMIT 1;
  bilh_por_nivel := COALESCE((econ->>'bilheteria_por_nivel')::numeric, 500000);
  manut_por_nivel := COALESCE((econ->>'manutencao_por_nivel_base')::numeric, 300000);

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' ORDER BY name LOOP
    rb := COALESCE((econ->'receita_base'->>c.reputacao::text)::numeric, 0);
    bilh := (c.nivel_estadio * bilh_por_nivel) * (c.rate / 3.0);
    manut := c.nivel_base * manut_por_nivel;
    prem := CASE
      WHEN c.posicao_ultima_temporada IS NULL THEN 0
      WHEN c.posicao_ultima_temporada = 1 THEN COALESCE((econ->'premiacao'->>'1')::numeric, 0)
      WHEN c.posicao_ultima_temporada = 2 THEN COALESCE((econ->'premiacao'->>'2')::numeric, 0)
      WHEN c.posicao_ultima_temporada = 3 THEN COALESCE((econ->'premiacao'->>'3')::numeric, 0)
      WHEN c.posicao_ultima_temporada = 4 THEN COALESCE((econ->'premiacao'->>'4')::numeric, 0)
      WHEN c.posicao_ultima_temporada BETWEEN 5 AND 8 THEN COALESCE((econ->'premiacao'->>'5_8')::numeric, 0)
      WHEN c.posicao_ultima_temporada BETWEEN 9 AND 12 THEN COALESCE((econ->'premiacao'->>'9_12')::numeric, 0)
      WHEN c.posicao_ultima_temporada BETWEEN 13 AND 16 THEN COALESCE((econ->'premiacao'->>'13_16')::numeric, 0)
      WHEN c.posicao_ultima_temporada BETWEEN 17 AND 20 THEN COALESCE((econ->'premiacao'->>'17_20')::numeric, 0)
      ELSE 0
    END;
    SELECT COALESCE(SUM(salario_atual),0) INTO flh FROM public.players WHERE players.club_id = c.id;
    SELECT COALESCE(SUM(valor_anual),0) INTO ctr FROM public.contratos_clube WHERE contratos_clube.club_id = c.id AND ativo = true;

    club_id := c.id; club_name := c.name; reputacao := c.reputacao::text;
    receita_base := rb; bilheteria := bilh; contratos := ctr; premiacao := prem;
    manutencao := manut; folha := flh;
    delta := rb + bilh + ctr + prem - manut - flh;
    novo_caixa := c.budget + delta;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- 9. Função de ajuste em massa de caixa
CREATE OR REPLACE FUNCTION public.ajustar_caixa_clubes(_club_ids uuid[], _delta numeric)
 RETURNS INTEGER
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem ajustar caixa em massa';
  END IF;
  UPDATE public.clubs SET budget = budget + _delta WHERE id = ANY(_club_ids);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$function$;