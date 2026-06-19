-- 1) Remove o trigger e função que limitavam o potencial da base a 65
DROP TRIGGER IF EXISTS trg_enforce_academy_cap ON public.academy_players;
DROP FUNCTION IF EXISTS public.enforce_academy_cap();

-- 2) Regenera potenciais dos jogadores existentes da base usando os pesos por nivel_base
WITH faixa AS (
  SELECT ap.id, c.nivel_base,
         random() * 100 AS r,
         (CASE c.nivel_base
            WHEN 1 THEN ARRAY[50, 35, 12, 2.5, 0.5]
            WHEN 2 THEN ARRAY[30, 40, 22, 6.5, 1.5]
            WHEN 3 THEN ARRAY[15, 35, 35, 12, 3]
            WHEN 4 THEN ARRAY[8, 25, 40, 22, 5]
            WHEN 5 THEN ARRAY[3, 12, 50, 27, 8]
            ELSE ARRAY[50, 35, 12, 2.5, 0.5]
          END)::numeric[] AS w
  FROM public.academy_players ap
  JOIN public.clubs c ON c.id = ap.club_id
),
band AS (
  SELECT id,
    CASE
      WHEN r <= w[1] THEN '60_69'
      WHEN r <= w[1]+w[2] THEN '70_79'
      WHEN r <= w[1]+w[2]+w[3] THEN '80_86'
      WHEN r <= w[1]+w[2]+w[3]+w[4] THEN '87_91'
      ELSE '92_94'
    END AS faixa
  FROM faixa
),
gen AS (
  SELECT b.id,
    CASE b.faixa
      WHEN '60_69' THEN 60 + floor(random() * 10)::INTEGER
      WHEN '70_79' THEN 70 + floor(random() * 10)::INTEGER
      WHEN '80_86' THEN 80 + floor(random() * 7)::INTEGER
      WHEN '87_91' THEN 87 + floor(random() * 5)::INTEGER
      WHEN '92_94' THEN 92 + floor(random() * 3)::INTEGER
    END AS pmax_raw
  FROM band b
)
UPDATE public.academy_players ap
SET potential_max = LEAST(94, g.pmax_raw),
    potential_min = GREATEST(45, LEAST(94, g.pmax_raw) - (4 + floor(random() * 5)::INTEGER))
FROM gen g
WHERE ap.id = g.id;

-- Garante consistência (skill <= pmax; pmin <= pmax)
UPDATE public.academy_players
SET potential_min = LEAST(potential_min, potential_max)
WHERE potential_min > potential_max;

UPDATE public.academy_players
SET skill = LEAST(skill, potential_max)
WHERE skill > potential_max;