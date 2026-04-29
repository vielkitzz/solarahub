-- 1. Tabela de marcas bloqueadas por clube
CREATE TABLE IF NOT EXISTS public.marcas_bloqueadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL,
  empresa_nome TEXT NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (club_id, empresa_nome)
);

ALTER TABLE public.marcas_bloqueadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view marcas_bloqueadas"
  ON public.marcas_bloqueadas FOR SELECT
  USING (true);

CREATE POLICY "Admins manage marcas_bloqueadas"
  ON public.marcas_bloqueadas FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Permite que owner do clube ou sistema (via trigger SECURITY DEFINER) insira
CREATE POLICY "Owner can register block"
  ON public.marcas_bloqueadas FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid())
  );

-- 2. Função: registra bloqueio quando contrato fica inativo
CREATE OR REPLACE FUNCTION public.bloquear_marca_apos_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_nome TEXT;
BEGIN
  -- Só age quando ativo passa de true para false
  IF TG_OP = 'UPDATE' AND OLD.ativo = true AND NEW.ativo = false AND NEW.empresa_id IS NOT NULL THEN
    SELECT nome INTO emp_nome FROM public.empresas WHERE id = NEW.empresa_id;
    IF emp_nome IS NOT NULL THEN
      INSERT INTO public.marcas_bloqueadas (club_id, empresa_nome, motivo)
      VALUES (NEW.club_id, emp_nome, 'Contrato encerrado/rescindido')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_marca ON public.contratos_clube;
CREATE TRIGGER trg_bloquear_marca
  AFTER UPDATE ON public.contratos_clube
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_marca_apos_contrato();

-- 3. Validação de fair-play de patrocínio + bloqueio
CREATE OR REPLACE FUNCTION public.validar_contrato_patrocinio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  emp RECORD;
  prestigio NUMERIC;
  rep_rank INTEGER;
  setor_lower TEXT;
BEGIN
  IF NEW.empresa_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO c FROM public.clubs WHERE id = NEW.club_id;
  SELECT * INTO emp FROM public.empresas WHERE id = NEW.empresa_id;
  IF c IS NULL OR emp IS NULL THEN RETURN NEW; END IF;

  -- Bloqueio histórico
  IF EXISTS (
    SELECT 1 FROM public.marcas_bloqueadas
    WHERE club_id = NEW.club_id AND lower(empresa_nome) = lower(emp.nome)
  ) THEN
    RAISE EXCEPTION 'A marca % já teve contrato com esse clube e está bloqueada permanentemente.', emp.nome;
  END IF;

  -- Fair-play: rate < 3.05 e reputação abaixo de nacional não podem contratar empresas grandes
  rep_rank := CASE lower(coalesce(c.reputacao::text, ''))
    WHEN 'local' THEN 1
    WHEN 'estadual' THEN 2
    WHEN 'nacional' THEN 3
    WHEN 'continental' THEN 4
    WHEN 'mundial' THEN 5
    ELSE 0
  END;

  -- Estimativa de prestígio: usa valor_anual_sugerido como proxy (>= 5M = prestígio > 1)
  prestigio := CASE
    WHEN emp.valor_anual_sugerido >= 8000000 THEN 1.5
    WHEN emp.valor_anual_sugerido >= 5000000 THEN 1.1
    ELSE 0.9
  END;

  setor_lower := lower(coalesce(emp.exigencias, ''));

  IF c.rate < 3.05
     AND rep_rank < 3
     AND prestigio > 1.5
     AND NEW.categoria::text NOT IN ('fornecedora')
     AND setor_lower NOT LIKE '%casa de apostas%'
     AND setor_lower NOT LIKE '%aposta%'
  THEN
    RAISE EXCEPTION 'Clube com rate % e reputação % não pode contratar marcas de prestígio acima de 1.00 (exceto fornecedoras e casas de apostas).', c.rate, c.reputacao;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_patrocinio ON public.contratos_clube;
CREATE TRIGGER trg_validar_patrocinio
  BEFORE INSERT ON public.contratos_clube
  FOR EACH ROW EXECUTE FUNCTION public.validar_contrato_patrocinio();

-- 4. Função: salário sugerido coerente
CREATE OR REPLACE FUNCTION public.sugerir_salario_jogador(_jogador_id uuid)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT GREATEST(50000, ROUND(COALESCE(valor_base_calculado, 0) * 0.10))
  FROM public.players WHERE id = _jogador_id;
$$;

-- 5. Peneira com multiseleção de posição
CREATE OR REPLACE FUNCTION public.realizar_peneira_v2(
  _club_id uuid,
  _positions text[],
  _age_min integer,
  _age_max integer,
  _nationality text
)
RETURNS TABLE(
  scout_id uuid, scout_name text, scout_position text, scout_age integer,
  scout_nationality text, scout_skill integer,
  scout_potential_min integer, scout_potential_max integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  weights NUMERIC[];
  qty INTEGER;
  i INTEGER; j INTEGER;
  rand NUMERIC; acc NUMERIC; faixa TEXT;
  pmax INTEGER; pmin INTEGER; age_v INTEGER; skill_v INTEGER;
  all_positions TEXT[] := ARRAY['GOL','ZAG','LD','LE','VOL','MC','MEI','PD','PE','SA','ATA'];
  pool TEXT[];
  chosen_pos TEXT;
BEGIN
  SELECT * INTO c FROM public.clubs WHERE id = _club_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado'; END IF;

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

  -- Pool de posições: usa as escolhidas; se vazia/null, usa todas
  IF _positions IS NULL OR array_length(_positions, 1) IS NULL OR array_length(_positions, 1) = 0 THEN
    pool := all_positions;
  ELSE
    pool := _positions;
  END IF;

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

    chosen_pos := pool[1 + floor(random() * array_length(pool, 1))::INTEGER];

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

-- 6. Função: gerar potencial conservador para todos os jogadores (admin)
CREATE OR REPLACE FUNCTION public.gerar_potenciais_em_massa()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  bonus INTEGER;
  pmax INTEGER;
  pmin INTEGER;
  affected INTEGER := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  FOR p IN SELECT id, age, habilidade FROM public.players WHERE habilidade IS NOT NULL LOOP
    IF p.age IS NULL THEN CONTINUE; END IF;
    -- Conservador: ≤21 = +8 a +15; 22-26 = +4 a +8; 27+ = +0 a +3
    IF p.age <= 21 THEN
      bonus := 8 + floor(random() * 8)::INTEGER;
    ELSIF p.age <= 26 THEN
      bonus := 4 + floor(random() * 5)::INTEGER;
    ELSE
      bonus := floor(random() * 4)::INTEGER;
    END IF;
    pmax := LEAST(94, p.habilidade + bonus);
    pmin := GREATEST(p.habilidade, pmax - (3 + floor(random() * 4)::INTEGER));
    UPDATE public.players SET potential_max = pmax, potential_min = pmin WHERE id = p.id;
    affected := affected + 1;
  END LOOP;
  RETURN affected;
END;
$$;

-- 7. Função: envelhecer todos os jogadores
CREATE OR REPLACE FUNCTION public.envelhecer_todos_jogadores()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  UPDATE public.players SET age = age + 1 WHERE age IS NOT NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;