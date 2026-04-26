CREATE OR REPLACE FUNCTION public.realizar_peneira(
  _club_id UUID,
  _position TEXT,
  _age_min INTEGER,
  _age_max INTEGER,
  _nationality TEXT
)
RETURNS TABLE (
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
  weights NUMERIC[];
  qty INTEGER;
  i INTEGER;
  j INTEGER;
  rand NUMERIC;
  acc NUMERIC;
  faixa TEXT;
  pmax INTEGER;
  pmin INTEGER;
  age_v INTEGER;
  skill_v INTEGER;
  positions TEXT[] := ARRAY['GOL','ZAG','LD','LE','VOL','MC','MEI','PD','PE','SA','ATA'];
  chosen_pos TEXT;
BEGIN
  SELECT * INTO c FROM public.clubs WHERE id = _club_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clube não encontrado';
  END IF;

  IF (c.academy_scouting_count, 0) IS NULL THEN
    NULL;
  END IF;
  IF COALESCE(c.academy_scouting_count, 0) >= 2 THEN
    RAISE EXCEPTION 'Limite de peneiras desta temporada atingido';
  END IF;

  IF _age_min < 14 OR _age_max > 23 OR _age_min > _age_max THEN
    RAISE EXCEPTION 'Faixa de idade inválida (14-23)';
  END IF;

  weights := CASE c.nivel_base
    WHEN 1 THEN ARRAY[50, 35, 12, 2.5, 0.5]
    WHEN 2 THEN ARRAY[30, 40, 22, 6.5, 1.5]
    WHEN 3 THEN ARRAY[15, 35, 35, 12, 3]
    WHEN 4 THEN ARRAY[8, 25, 40, 22, 5]
    WHEN 5 THEN ARRAY[3, 12, 50, 27, 8]
    ELSE ARRAY[50, 35, 12, 2.5, 0.5]
  END;

  qty := 3 + floor(random() * 6)::INTEGER;

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
    pmin := pmax - (4 + floor(random() * 5)::INTEGER);
    pmin := GREATEST(45, pmin);

    age_v := _age_min + floor(random() * (_age_max - _age_min + 1))::INTEGER;
    skill_v := 30 + floor(random() * 23)::INTEGER;

    IF _position IS NULL OR length(_position) = 0 THEN
      chosen_pos := positions[1 + floor(random() * array_length(positions, 1))::INTEGER];
    ELSE
      chosen_pos := _position;
    END IF;

    scout_id := gen_random_uuid();
    scout_name := 'Jogador ' || substr(scout_id::text, 1, 4);
    scout_position := chosen_pos;
    scout_age := age_v;
    scout_nationality := _nationality;
    scout_skill := skill_v;
    scout_potential_min := pmin;
    scout_potential_max := pmax;
    RETURN NEXT;
  END LOOP;

  UPDATE public.clubs SET academy_scouting_count = COALESCE(academy_scouting_count, 0) + 1 WHERE id = _club_id;
END;
$$;