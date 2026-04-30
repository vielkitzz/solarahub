-- 1) Adiciona coluna shirt_number em players
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS shirt_number INTEGER CHECK (shirt_number IS NULL OR (shirt_number BETWEEN 1 AND 99));

-- 2) Tabela de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  club_id UUID,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, lida, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "System inserts notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3) Atualiza process_season_turnover: bilheteria detalhada + aposentadoria com notificação
CREATE OR REPLACE FUNCTION public.process_season_turnover()
 RETURNS TABLE(club_id uuid, club_name text, delta numeric, novo_caixa numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
  ap RECORD;
  pl RECORD;
  v_tv NUMERIC;
  bilheteria NUMERIC;
  manutencao NUMERIC;
  folha NUMERIC;
  contratos NUMERIC;
  premiacao NUMERIC;
  total_delta NUMERIC;
  temp_atual INTEGER;
  nova_temp INTEGER;
  ganho_progresso NUMERIC;
  mult_base NUMERIC;
  novo_skill INTEGER;
  preco_medio NUMERIC;
  jogos INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar a virada de temporada';
  END IF;

  UPDATE public.players SET habilidade = habilidade;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;
  nova_temp := temp_atual + 1;

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' LOOP
    v_tv := public.get_tv_rights_value(c.id);

    -- NOVA BILHETERIA: capacity * 0.85 * preço_médio * jogos * (rate/3)
    preco_medio := (COALESCE(c.preco_ingresso_nacional, 0) + COALESCE(c.preco_ingresso_internacional, 0)) / 2.0;
    jogos := COALESCE(c.jogos_por_temporada, 38);
    bilheteria := COALESCE(c.stadium_capacity, 0) * 0.85 * preco_medio * jogos * (c.rate / 3.0);

    manutencao := c.nivel_base * 300000;
    premiacao := public.premiacao_por_posicao(c.posicao_ultima_temporada);

    SELECT COALESCE(SUM(salario_atual), 0) INTO folha
      FROM public.players WHERE players.club_id = c.id;

    SELECT COALESCE(SUM(valor_anual), 0) INTO contratos
      FROM public.contratos_clube
      WHERE contratos_clube.club_id = c.id AND ativo = true;

    total_delta := v_tv + bilheteria + contratos + premiacao - manutencao - folha;

    UPDATE public.clubs SET budget = budget + total_delta WHERE id = c.id;

    mult_base := CASE c.nivel_base
      WHEN 1 THEN 0.8 WHEN 2 THEN 0.95 WHEN 3 THEN 1.1 WHEN 4 THEN 1.2 WHEN 5 THEN 1.3
      ELSE 1.0
    END;

    FOR ap IN SELECT * FROM public.academy_players WHERE academy_players.club_id = c.id LOOP
      ganho_progresso := CASE
        WHEN ap.age <= 18 THEN 15 + random() * 5
        WHEN ap.age <= 21 THEN 10 + random() * 5
        ELSE 5 + random() * 5
      END;
      ganho_progresso := ganho_progresso * mult_base;

      IF ap.development_progress < 100 THEN
        novo_skill := LEAST(
          ap.potential_max,
          ap.skill + ROUND(((ap.potential_max - ap.skill) * (ganho_progresso / 100.0)))::INTEGER
        );
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

        UPDATE public.players
          SET habilidade = novo_skill,
              age = pl.age + 1
          WHERE id = pl.id;
      END IF;
    END LOOP;

    club_id := c.id;
    club_name := c.name;
    delta := total_delta;
    novo_caixa := c.budget + total_delta;
    RETURN NEXT;
  END LOOP;

  UPDATE public.clubs SET academy_scouting_count = 0;

  UPDATE public.players SET club_id = NULL, a_venda = false
  WHERE contrato_ate IS NOT NULL AND contrato_ate <= temp_atual;

  PERFORM public.processar_aposentadorias();

  UPDATE public.settings SET value = jsonb_build_object('ano', nova_temp)
  WHERE key = 'temporada_atual';
END;
$function$;

-- 4) Atualiza preview_season_turnover com a mesma fórmula
CREATE OR REPLACE FUNCTION public.preview_season_turnover()
 RETURNS TABLE(club_id uuid, club_name text, reputacao text, receita_base numeric, bilheteria numeric, contratos numeric, premiacao numeric, manutencao numeric, folha numeric, delta numeric, novo_caixa numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD; econ JSONB;
  rb NUMERIC; bilh NUMERIC; manut NUMERIC; flh NUMERIC; ctr NUMERIC; prem NUMERIC;
  manut_por_nivel NUMERIC;
  preco_medio NUMERIC; jogos INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem ver a prévia';
  END IF;
  SELECT value INTO econ FROM public.settings WHERE key = 'economia_params' LIMIT 1;
  manut_por_nivel := COALESCE((econ->>'manutencao_por_nivel_base')::numeric, 300000);

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' ORDER BY name LOOP
    rb := public.get_tv_rights_value(c.id);
    preco_medio := (COALESCE(c.preco_ingresso_nacional, 0) + COALESCE(c.preco_ingresso_internacional, 0)) / 2.0;
    jogos := COALESCE(c.jogos_por_temporada, 38);
    bilh := COALESCE(c.stadium_capacity, 0) * 0.85 * preco_medio * jogos * (c.rate / 3.0);
    manut := c.nivel_base * manut_por_nivel;
    prem := public.premiacao_por_posicao(c.posicao_ultima_temporada);
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

-- 5) Aposentadoria com notificação ao dono
CREATE OR REPLACE FUNCTION public.processar_aposentadorias()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  chance NUMERIC;
  v_owner UUID;
  v_club_name TEXT;
BEGIN
  FOR p IN SELECT id, age, name, club_id FROM public.players WHERE age >= 34 LOOP
    chance := 5 + ((p.age - 34) * 10);
    IF random() * 100 <= chance THEN
      IF p.club_id IS NOT NULL THEN
        SELECT owner_id, name INTO v_owner, v_club_name FROM public.clubs WHERE id = p.club_id;
        IF v_owner IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, club_id, tipo, titulo, mensagem, payload)
          VALUES (
            v_owner, p.club_id, 'aposentadoria',
            'Aposentadoria: ' || p.name,
            p.name || ' (' || p.age || ' anos) encerrou a carreira e deixou o ' || v_club_name || '.',
            jsonb_build_object('player_name', p.name, 'age', p.age)
          );
        END IF;
      END IF;
      DELETE FROM public.players WHERE id = p.id;
    END IF;
  END LOOP;
END;
$function$;

-- 6) Função de pagar multa rescisória (10x valor calculado)
-- Caso A: outro clube compra pagando a multa (jogador vai direto para esse clube)
CREATE OR REPLACE FUNCTION public.pagar_multa_rescisoria(_jogador_id uuid, _clube_comprador_id uuid, _novo_salario numeric, _anos_contrato integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  multa NUMERIC;
  caixa_comp NUMERIC;
  temp_atual INTEGER;
  v_owner_atual UUID;
  v_clube_atual_nome TEXT;
  v_clube_comp_nome TEXT;
BEGIN
  SELECT * INTO p FROM public.players WHERE id = _jogador_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;
  IF p.club_id IS NULL THEN RAISE EXCEPTION 'Jogador é agente livre, não tem multa'; END IF;
  IF p.club_id = _clube_comprador_id THEN RAISE EXCEPTION 'Clube já é o dono do jogador'; END IF;

  -- Permissão: admin ou dono do clube comprador
  IF NOT (has_role(auth.uid(), 'admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.clubs WHERE id = _clube_comprador_id AND owner_id = auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  multa := COALESCE(p.valor_base_calculado, 0) * 10;
  IF multa <= 0 THEN RAISE EXCEPTION 'Multa inválida (valor base zero)'; END IF;

  SELECT budget INTO caixa_comp FROM public.clubs WHERE id = _clube_comprador_id FOR UPDATE;
  IF caixa_comp < multa THEN
    RAISE EXCEPTION 'Caixa insuficiente. Necessário % para pagar a multa.', multa;
  END IF;

  SELECT owner_id, name INTO v_owner_atual, v_clube_atual_nome FROM public.clubs WHERE id = p.club_id;
  SELECT name INTO v_clube_comp_nome FROM public.clubs WHERE id = _clube_comprador_id;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  -- Transferência financeira
  UPDATE public.clubs SET budget = budget - multa WHERE id = _clube_comprador_id;
  UPDATE public.clubs SET budget = budget + multa WHERE id = p.club_id;

  -- Move jogador
  UPDATE public.players
    SET club_id = _clube_comprador_id,
        salario_atual = _novo_salario,
        contrato_ate = temp_atual + GREATEST(_anos_contrato, 1),
        a_venda = false
    WHERE id = _jogador_id;

  -- Notifica dono antigo
  IF v_owner_atual IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, club_id, tipo, titulo, mensagem, payload)
    VALUES (
      v_owner_atual, p.club_id, 'multa_paga',
      'Multa paga: ' || p.name,
      'O ' || v_clube_comp_nome || ' pagou a multa rescisória de ' || multa::text || ' para tirar ' || p.name || ' do seu clube.',
      jsonb_build_object('player_name', p.name, 'multa', multa, 'comprador', v_clube_comp_nome)
    );
  END IF;

  RETURN jsonb_build_object('multa', multa, 'jogador', p.name);
END;
$function$;

-- Caso B: dono do clube atual paga a multa para LIBERAR jogador como agente livre
CREATE OR REPLACE FUNCTION public.liberar_jogador_pagando_multa(_jogador_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  multa NUMERIC;
  caixa NUMERIC;
BEGIN
  SELECT * INTO p FROM public.players WHERE id = _jogador_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;
  IF p.club_id IS NULL THEN RAISE EXCEPTION 'Jogador já é agente livre'; END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.clubs WHERE id = p.club_id AND owner_id = auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  multa := COALESCE(p.valor_base_calculado, 0) * 10;
  SELECT budget INTO caixa FROM public.clubs WHERE id = p.club_id FOR UPDATE;
  IF caixa < multa THEN RAISE EXCEPTION 'Caixa insuficiente. Necessário % para liberar o jogador.', multa; END IF;

  UPDATE public.clubs SET budget = budget - multa WHERE id = p.club_id;
  UPDATE public.players
    SET club_id = NULL, a_venda = false, salario_atual = 0, contrato_ate = NULL
    WHERE id = _jogador_id;

  RETURN jsonb_build_object('multa', multa, 'jogador', p.name);
END;
$function$;