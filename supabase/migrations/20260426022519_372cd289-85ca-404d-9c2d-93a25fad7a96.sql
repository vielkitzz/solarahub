-- =====================================================
-- 1) PLAYERS: potencial
-- =====================================================
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS potential_min INTEGER,
  ADD COLUMN IF NOT EXISTS potential_max INTEGER;

ALTER TABLE public.players
  ADD CONSTRAINT players_potential_range
  CHECK (
    (potential_min IS NULL OR (potential_min >= 45 AND potential_min <= 99))
    AND (potential_max IS NULL OR (potential_max >= 45 AND potential_max <= 99))
    AND (potential_min IS NULL OR potential_max IS NULL OR potential_min <= potential_max)
  );

-- Inicializa potencial para jogadores existentes
UPDATE public.players
SET potential_max = LEAST(94, GREATEST(60, COALESCE(habilidade, 60) + 8)),
    potential_min = LEAST(94, GREATEST(45, COALESCE(habilidade, 60) + 2))
WHERE potential_max IS NULL OR potential_min IS NULL;

-- =====================================================
-- 2) CLUBS: contador de peneiras
-- =====================================================
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS academy_scouting_count INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- 3) ACADEMY_PLAYERS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.academy_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  age INTEGER NOT NULL,
  nationality TEXT,
  skill INTEGER NOT NULL DEFAULT 30,
  potential_min INTEGER NOT NULL,
  potential_max INTEGER NOT NULL,
  development_progress NUMERIC NOT NULL DEFAULT 0,
  seasons_in_academy INTEGER NOT NULL DEFAULT 0,
  free_agent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (skill >= 30 AND skill <= 99),
  CHECK (potential_min >= 45 AND potential_min <= 99),
  CHECK (potential_max >= 45 AND potential_max <= 99),
  CHECK (potential_min <= potential_max),
  CHECK (development_progress >= 0 AND development_progress <= 100),
  CHECK (age >= 14 AND age <= 30)
);

CREATE INDEX IF NOT EXISTS idx_academy_players_club ON public.academy_players(club_id);

ALTER TABLE public.academy_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view academy_players"
  ON public.academy_players FOR SELECT
  USING (true);

CREATE POLICY "Owner or admin manage academy_players"
  ON public.academy_players FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE clubs.id = academy_players.club_id AND clubs.owner_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE clubs.id = academy_players.club_id AND clubs.owner_id = auth.uid())
  );

-- =====================================================
-- 4) RPC: realizar_peneira
-- =====================================================
CREATE OR REPLACE FUNCTION public.realizar_peneira(
  _club_id UUID,
  _position TEXT,
  _age_min INTEGER,
  _age_max INTEGER,
  _nationality TEXT
)
RETURNS TABLE(
  scout_id UUID,
  scout_name TEXT,
  scout_position TEXT,
  scout_age INTEGER,
  scout_nationality TEXT,
  scout_skill INTEGER,
  scout_potential_min INTEGER,
  scout_potential_max INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  i INTEGER;
  qty INTEGER;
  pmax INTEGER;
  pmin INTEGER;
  faixa TEXT;
  weights NUMERIC[];
  rand NUMERIC;
  acc NUMERIC;
  age_v INTEGER;
  skill_v INTEGER;
BEGIN
  SELECT * INTO c FROM public.clubs WHERE id = _club_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado'; END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR c.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para realizar peneira';
  END IF;

  IF c.academy_scouting_count >= 2 THEN
    RAISE EXCEPTION 'Limite de 2 peneiras por temporada já atingido';
  END IF;

  IF _age_min < 14 OR _age_max > 23 OR _age_min > _age_max THEN
    RAISE EXCEPTION 'Faixa de idade inválida (14-23)';
  END IF;
  IF _position IS NULL OR length(_position) = 0 THEN
    RAISE EXCEPTION 'Posição obrigatória';
  END IF;

  -- Pesos por nível da base (faixas: 60-69, 70-79, 80-86, 87-91, 92-94)
  weights := CASE c.nivel_base
    WHEN 1 THEN ARRAY[70, 23,  6,   0.9, 0.1] -- Nível 1: Quase impossível vir craque
    WHEN 2 THEN ARRAY[55, 30, 12,   2.5, 0.5] 
    WHEN 3 THEN ARRAY[35, 40, 19,   5,   1]   
    WHEN 4 THEN ARRAY[20, 40, 28,   10,  2]   
    WHEN 5 THEN ARRAY[10, 30, 40,   16,  4]   -- Nível 5: Craque geracional (92+) acontece apenas em 4% dos casos
    ELSE ARRAY[70, 23, 6, 0.9, 0.1]
  END;

  qty := 3 + floor(random() * 6)::INTEGER; -- 3 a 8

  FOR i IN 1..qty LOOP
    rand := random() * 100;
    acc := 0;
    faixa := '60_69';
    FOR j IN 1..5 LOOP
      acc := acc + weights[j];
      IF rand <= acc THEN
        faixa := CASE j
          WHEN 1 THEN '60_69'
          WHEN 2 THEN '70_79'
          WHEN 3 THEN '80_86'
          WHEN 4 THEN '87_91'
          WHEN 5 THEN '92_94'
        END;
        EXIT;
      END IF;
    END LOOP;

    pmax := CASE faixa
      WHEN '60_69' THEN 60 + floor(random() * 10)::INTEGER
      WHEN '70_79' THEN 70 + floor(random() * 10)::INTEGER
      WHEN '80_86' THEN 80 + floor(random() * 7)::INTEGER
      WHEN '87_91' THEN 87 + floor(random() * 5)::INTEGER
      WHEN '92_94' THEN 92 + floor(random() * 3)::INTEGER
    END;
    pmax := LEAST(94, pmax);
    pmin := pmax - (4 + floor(random() * 5)::INTEGER); -- 4 a 8 abaixo
    pmin := GREATEST(45, pmin);

    age_v := _age_min + floor(random() * (_age_max - _age_min + 1))::INTEGER;
    skill_v := 30 + floor(random() * 23)::INTEGER; -- 30 a 52

    scout_id := gen_random_uuid();
    scout_name := 'Jogador ' || substr(scout_id::text, 1, 4);
    scout_position := _position;
    scout_age := age_v;
    scout_nationality := _nationality;
    scout_skill := skill_v;
    scout_potential_min := pmin;
    scout_potential_max := pmax;
    RETURN NEXT;
  END LOOP;

  -- consome 1 peneira
  UPDATE public.clubs SET academy_scouting_count = academy_scouting_count + 1 WHERE id = _club_id;
END;
$$;

-- =====================================================
-- 5) RPC: promover_academia
-- =====================================================
CREATE OR REPLACE FUNCTION public.promover_academia(_academy_player_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ap RECORD;
  novo_id UUID;
  novo_pmax INTEGER;
  novo_pmin INTEGER;
  penalidade INTEGER;
  temp_atual INTEGER;
BEGIN
  SELECT * INTO ap FROM public.academy_players WHERE id = _academy_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador da academia não encontrado'; END IF;

  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE id = ap.club_id AND owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- Penalidade proporcional ao desenvolvimento que faltou
  -- Ex: progresso 60% → faltam 40% → penalidade = round(40/10) = 4 pontos a menos no potential_max
  penalidade := round((100 - ap.development_progress) / 10.0)::INTEGER;
  novo_pmax := GREATEST(45, ap.potential_max - penalidade);
  novo_pmin := GREATEST(45, LEAST(novo_pmax, ap.potential_min - penalidade));

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  -- Cria no elenco principal (trigger calc_player_value cuida de valor/salario)
  INSERT INTO public.players (
    club_id, name, position, age, nationality,
    habilidade, potential_min, potential_max,
    contrato_ate, attributes
  ) VALUES (
    ap.club_id, ap.name, ap.position, ap.age, ap.nationality,
    GREATEST(45, ap.skill), novo_pmin, novo_pmax,
    temp_atual + 3,
    jsonb_build_object(
      'origem', 'academia',
      'penalidade_potencial', penalidade,
      'progresso_ao_promover', ap.development_progress
    )
  ) RETURNING id INTO novo_id;

  DELETE FROM public.academy_players WHERE id = _academy_player_id;
  RETURN novo_id;
END;
$$;

-- =====================================================
-- 6) Atualiza process_season_turnover
-- =====================================================
CREATE OR REPLACE FUNCTION public.process_season_turnover()
RETURNS TABLE(club_id uuid, club_name text, delta numeric, novo_caixa numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  ap RECORD;
  pl RECORD;
  receita_base NUMERIC;
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

    -- Multiplicador do nível da base (0.8 a 1.3)
    mult_base := CASE c.nivel_base
      WHEN 1 THEN 0.8 WHEN 2 THEN 0.95 WHEN 3 THEN 1.1 WHEN 4 THEN 1.2 WHEN 5 THEN 1.3
      ELSE 1.0
    END;

    -- Desenvolvimento da academia
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

    -- Evolução / declínio do elenco principal
    FOR pl IN SELECT * FROM public.players WHERE players.club_id = c.id LOOP
      IF pl.age IS NOT NULL AND pl.habilidade IS NOT NULL AND pl.potential_max IS NOT NULL THEN
        IF pl.age >= 31 THEN
          -- Declínio: -1 a -3 por temporada
          novo_skill := GREATEST(45, pl.habilidade - (1 + floor(random() * 3))::INTEGER);
        ELSIF pl.age <= 27 AND pl.habilidade < pl.potential_max THEN
          -- Progressão proporcional ao quão longe está do potencial
          novo_skill := LEAST(
            pl.potential_max,
            pl.habilidade + (1 + floor(random() * 3))::INTEGER
          );
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

  -- Reseta peneiras
  UPDATE public.clubs SET academy_scouting_count = 0;

  -- Libera jogadores com contrato vencido
  UPDATE public.players SET club_id = NULL, a_venda = false
  WHERE contrato_ate IS NOT NULL AND contrato_ate <= temp_atual;

  -- Avança a temporada
  UPDATE public.settings SET value = jsonb_build_object('ano', nova_temp)
  WHERE key = 'temporada_atual';
END;
$$;