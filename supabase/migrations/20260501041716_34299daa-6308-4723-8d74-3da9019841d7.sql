-- Add scout searches counter to clubs
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS scout_searches_used INTEGER NOT NULL DEFAULT 0;

-- Scout reports table
CREATE TABLE IF NOT EXISTS public.scout_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scouter_club_id UUID NOT NULL,
  target_player_id UUID NOT NULL,
  potential_min_revelado INTEGER NOT NULL,
  potential_max_revelado INTEGER NOT NULL,
  margem_aplicada INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (scouter_club_id, target_player_id)
);

ALTER TABLE public.scout_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view scout_reports"
  ON public.scout_reports FOR SELECT
  USING (true);

CREATE POLICY "Owner or admin manage scout_reports"
  ON public.scout_reports FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.clubs WHERE clubs.id = scout_reports.scouter_club_id AND clubs.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.clubs WHERE clubs.id = scout_reports.scouter_club_id AND clubs.owner_id = auth.uid()
    )
  );

CREATE TRIGGER scout_reports_updated_at
  BEFORE UPDATE ON public.scout_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RPC: scout a player
CREATE OR REPLACE FUNCTION public.scout_player(_scouter_club_id UUID, _target_player_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  p RECORD;
  margem INTEGER;
  desvio_min INTEGER;
  desvio_max INTEGER;
  pmin_rev INTEGER;
  pmax_rev INTEGER;
  ja_existe BOOLEAN;
BEGIN
  SELECT * INTO c FROM public.clubs WHERE id = _scouter_club_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado'; END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR c.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para usar o olheiro deste clube';
  END IF;

  SELECT * INTO p FROM public.players WHERE id = _target_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;
  IF p.potential_max IS NULL THEN RAISE EXCEPTION 'Jogador sem potencial calculado'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.scout_reports
    WHERE scouter_club_id = _scouter_club_id AND target_player_id = _target_player_id
  ) INTO ja_existe;

  -- Se já existe, não consome busca, apenas retorna o relatório existente
  IF ja_existe THEN
    SELECT potential_min_revelado, potential_max_revelado, margem_aplicada
      INTO pmin_rev, pmax_rev, margem
      FROM public.scout_reports
      WHERE scouter_club_id = _scouter_club_id AND target_player_id = _target_player_id;
    RETURN jsonb_build_object(
      'potential_min', pmin_rev,
      'potential_max', pmax_rev,
      'margem', margem,
      'searches_used', c.scout_searches_used,
      'ja_existia', true
    );
  END IF;

  IF COALESCE(c.scout_searches_used, 0) >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 pesquisas do olheiro atingido nesta temporada';
  END IF;

  -- Margem por nível da base (1 -> 12, 5 -> 2). Linear: 14 - nivel*2 -> 12,10,8,6,4 (mas pediu 12 e 2). Vamos calcular: 12 - (nivel-1)*2.5
  margem := GREATEST(2, ROUND(12 - ((COALESCE(c.nivel_base, 1) - 1) * 2.5))::INTEGER);

  desvio_min := -margem + floor(random() * (margem * 2 + 1))::INTEGER;
  desvio_max := -margem + floor(random() * (margem * 2 + 1))::INTEGER;

  pmin_rev := GREATEST(45, LEAST(99, p.potential_min + desvio_min));
  pmax_rev := GREATEST(pmin_rev, LEAST(99, p.potential_max + desvio_max));

  INSERT INTO public.scout_reports (scouter_club_id, target_player_id, potential_min_revelado, potential_max_revelado, margem_aplicada)
  VALUES (_scouter_club_id, _target_player_id, pmin_rev, pmax_rev, margem);

  UPDATE public.clubs SET scout_searches_used = COALESCE(scout_searches_used, 0) + 1 WHERE id = _scouter_club_id;

  RETURN jsonb_build_object(
    'potential_min', pmin_rev,
    'potential_max', pmax_rev,
    'margem', margem,
    'searches_used', c.scout_searches_used + 1,
    'ja_existia', false
  );
END;
$$;

-- Reset scout searches in season turnover
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
        IF pl.age >= 34 THEN
          novo_skill := GREATEST(45, pl.habilidade - (1 + floor(random() * 3))::INTEGER);
        ELSIF pl.age >= 31 THEN
          novo_skill := GREATEST(45, pl.habilidade - floor(random() * 2)::INTEGER);
        ELSIF pl.age <= 27 AND pl.habilidade < pl.potential_max THEN
          IF pl.age <= 21 THEN
            novo_skill := LEAST(pl.potential_max, pl.habilidade + (1 + floor(random() * 4))::INTEGER);
          ELSE
            novo_skill := LEAST(pl.potential_max, pl.habilidade + (1 + floor(random() * 2))::INTEGER);
          END IF;
        ELSE
          novo_skill := pl.habilidade;
        END IF;
        UPDATE public.players SET habilidade = novo_skill, age = pl.age + 1 WHERE id = pl.id;
      END IF;
    END LOOP;

    club_id := c.id;
    club_name := c.name;
    delta := total_delta;
    novo_caixa := c.budget + total_delta;
    RETURN NEXT;
  END LOOP;

  UPDATE public.clubs SET academy_scouting_count = 0, scout_searches_used = 0;

  UPDATE public.players SET club_id = NULL, a_venda = false
  WHERE contrato_ate IS NOT NULL AND contrato_ate <= temp_atual;

  PERFORM public.processar_aposentadorias();

  UPDATE public.settings SET value = jsonb_build_object('ano', nova_temp)
  WHERE key = 'temporada_atual';
END;
$function$;