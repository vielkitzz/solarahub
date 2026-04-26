-- contratos: duração + multa
ALTER TABLE public.contratos_clube
  ADD COLUMN IF NOT EXISTS anos_duracao INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS multa_rescisao NUMERIC GENERATED ALWAYS AS (valor_anual * 0.70) STORED;

-- clubs: estádio
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS preco_ingresso_nacional NUMERIC NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS preco_ingresso_internacional NUMERIC NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS jogos_por_temporada INTEGER NOT NULL DEFAULT 38;

-- Settings padrão
INSERT INTO public.settings (key, value) VALUES
  ('direitos_tv_por_reputacao', '{"estadual":1500000,"nacional":4000000,"continental":8000000,"mundial":12000000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value) VALUES
  ('direitos_imagem', '{"custo_pct":0.03,"receita_pct":0.5}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value) VALUES
  ('estadio_upgrade_custos', '{"1_2":1000000,"2_3":10000000,"3_4":50000000,"4_5":70000000,"por_lugar":500}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value) VALUES
  ('estadio_capacidade_max', '{"max":85000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Garante UNIQUE em settings.key (necessário para o ON CONFLICT acima — caso ainda não exista)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settings_key_key'
  ) THEN
    ALTER TABLE public.settings ADD CONSTRAINT settings_key_key UNIQUE (key);
  END IF;
END $$;

-- RPC upgrade_estadio
CREATE OR REPLACE FUNCTION public.upgrade_estadio(
  _club_id uuid,
  _novo_nivel integer,
  _nova_capacidade integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  custos JSONB;
  cap_max INTEGER;
  custo_por_lugar NUMERIC := 500;
  custo_total NUMERIC := 0;
  custo_nivel NUMERIC := 0;
  lugares_extras INTEGER := 0;
BEGIN
  SELECT * INTO c FROM public.clubs WHERE id = _club_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado'; END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR c.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para upgrade';
  END IF;

  SELECT value INTO custos FROM public.settings WHERE key = 'estadio_upgrade_custos';
  SELECT (value->>'max')::int INTO cap_max FROM public.settings WHERE key = 'estadio_capacidade_max';
  IF cap_max IS NULL THEN cap_max := 85000; END IF;
  IF custos ? 'por_lugar' THEN custo_por_lugar := (custos->>'por_lugar')::numeric; END IF;

  IF _novo_nivel < c.nivel_estadio OR _novo_nivel > 5 THEN
    RAISE EXCEPTION 'Nível inválido';
  END IF;
  IF _nova_capacidade < c.stadium_capacity OR _nova_capacidade > cap_max THEN
    RAISE EXCEPTION 'Capacidade inválida (máx %)', cap_max;
  END IF;

  -- Soma custos dos níveis percorridos
  IF _novo_nivel > c.nivel_estadio THEN
    FOR i IN c.nivel_estadio.._novo_nivel - 1 LOOP
      custo_nivel := COALESCE((custos->>(i || '_' || (i+1)))::numeric, 0);
      custo_total := custo_total + custo_nivel;
    END LOOP;
  END IF;

  lugares_extras := _nova_capacidade - c.stadium_capacity;
  custo_total := custo_total + (lugares_extras * custo_por_lugar);

  IF c.budget < custo_total THEN
    RAISE EXCEPTION 'Caixa insuficiente. Necessário %', custo_total;
  END IF;

  UPDATE public.clubs
    SET nivel_estadio = _novo_nivel,
        stadium_capacity = _nova_capacidade,
        budget = budget - custo_total
    WHERE id = _club_id;
END; $$;