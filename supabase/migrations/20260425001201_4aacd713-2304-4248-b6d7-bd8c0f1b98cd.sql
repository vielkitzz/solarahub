
-- Adiciona contrato_ate em players
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS contrato_ate INTEGER;

-- Inicializa contratos para jogadores existentes (3 anos a partir da temporada atual ou 2026)
DO $$
DECLARE
  temp_atual INTEGER;
BEGIN
  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;
  IF temp_atual IS NULL THEN temp_atual := 2026; END IF;
  
  UPDATE public.players SET contrato_ate = temp_atual + 3 WHERE contrato_ate IS NULL;
END $$;

-- Garante que temporada_atual existe em settings
INSERT INTO public.settings (key, value)
VALUES ('temporada_atual', '{"ano": 2026}'::jsonb)
ON CONFLICT DO NOTHING;

-- Função para renovar contrato (chamada pela edge function após IA aprovar)
CREATE OR REPLACE FUNCTION public.renovar_contrato_jogador(
  _jogador_id UUID,
  _novo_salario NUMERIC,
  _novos_anos INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  temp_atual INTEGER;
  p RECORD;
BEGIN
  SELECT * INTO p FROM public.players WHERE id = _jogador_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;
  
  -- Verifica permissão: admin ou owner do clube
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE id = p.club_id AND owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão para renovar contrato';
  END IF;
  
  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;
  
  UPDATE public.players
  SET salario_atual = _novo_salario,
      contrato_ate = temp_atual + GREATEST(_novos_anos, 1)
  WHERE id = _jogador_id;
END;
$$;

-- Atualiza process_season_turnover para liberar jogadores com contrato vencido
CREATE OR REPLACE FUNCTION public.process_season_turnover()
RETURNS TABLE(club_id uuid, club_name text, delta numeric, novo_caixa numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  receita_base NUMERIC;
  bilheteria NUMERIC;
  manutencao NUMERIC;
  folha NUMERIC;
  contratos NUMERIC;
  premiacao NUMERIC;
  total_delta NUMERIC;
  temp_atual INTEGER;
  nova_temp INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar a virada de temporada';
  END IF;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;
  nova_temp := temp_atual + 1;

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' LOOP
    receita_base := CASE c.reputacao
      WHEN 'estadual' THEN 4300000
      WHEN 'nacional' THEN 11500000
      WHEN 'continental' THEN 23000000
      WHEN 'mundial' THEN 45000000
      ELSE 0
    END;
    bilheteria := (c.nivel_estadio * 500000) * (c.rate / 3.0);
    manutencao := c.nivel_base * 300000;
    premiacao := premiacao_por_posicao(c.posicao_ultima_temporada);

    SELECT COALESCE(SUM(salario_atual), 0) INTO folha
      FROM public.players WHERE players.club_id = c.id;

    SELECT COALESCE(SUM(valor_anual), 0) INTO contratos
      FROM public.contratos_clube
      WHERE contratos_clube.club_id = c.id AND ativo = true;

    total_delta := receita_base + bilheteria + contratos + premiacao - manutencao - folha;

    UPDATE public.clubs SET budget = budget + total_delta WHERE id = c.id;

    club_id := c.id;
    club_name := c.name;
    delta := total_delta;
    novo_caixa := c.budget + total_delta;
    RETURN NEXT;
  END LOOP;

  -- Libera jogadores com contrato vencido (vira agente livre)
  UPDATE public.players SET club_id = NULL, a_venda = false
  WHERE contrato_ate IS NOT NULL AND contrato_ate <= temp_atual;

  -- Avança a temporada
  UPDATE public.settings SET value = jsonb_build_object('ano', nova_temp)
  WHERE key = 'temporada_atual';
END;
$$;
