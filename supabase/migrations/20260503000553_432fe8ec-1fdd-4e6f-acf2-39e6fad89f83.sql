
-- 1) Upgrade da base com cobrança + registro de transação
CREATE OR REPLACE FUNCTION public.upgrade_academia(_club_id uuid, _novo_nivel integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c RECORD;
  custos JSONB;
  custo_total NUMERIC := 0;
  custo_passo NUMERIC;
  v_temp INTEGER;
  i INTEGER;
BEGIN
  SELECT * INTO c FROM public.clubs WHERE id = _club_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado'; END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR c.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para upgrade da base';
  END IF;

  IF _novo_nivel <= c.nivel_base OR _novo_nivel > 5 THEN
    RAISE EXCEPTION 'Nível inválido (atual %, alvo %)', c.nivel_base, _novo_nivel;
  END IF;

  SELECT value INTO custos FROM public.settings WHERE key = 'base_upgrade_custos';

  FOR i IN c.nivel_base.._novo_nivel - 1 LOOP
    custo_passo := COALESCE(
      (custos->>(i || '_' || (i+1)))::numeric,
      -- fallback caso a setting ainda não exista
      CASE i WHEN 1 THEN 5000000 WHEN 2 THEN 12000000 WHEN 3 THEN 25000000 WHEN 4 THEN 50000000 ELSE 0 END
    );
    custo_total := custo_total + custo_passo;
  END LOOP;

  IF c.budget < custo_total THEN
    RAISE EXCEPTION 'Caixa insuficiente. Necessário %', custo_total;
  END IF;

  UPDATE public.clubs
    SET nivel_base = _novo_nivel,
        budget = budget - custo_total
    WHERE id = _club_id;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO v_temp FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  IF custo_total > 0 THEN
    INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao, temporada, metadata)
    VALUES (
      _club_id, 'saida', 'upgrade_base', custo_total,
      'Upgrade da base: nível ' || c.nivel_base || '→' || _novo_nivel,
      v_temp,
      jsonb_build_object('nivel_de', c.nivel_base, 'nivel_para', _novo_nivel)
    );
  END IF;
END;
$$;

-- Salva tabela de custos default da base se ainda não existir
INSERT INTO public.settings (key, value)
VALUES (
  'base_upgrade_custos',
  jsonb_build_object('1_2', 5000000, '2_3', 12000000, '3_4', 25000000, '4_5', 50000000)
)
ON CONFLICT (key) DO NOTHING;

-- 2) Geração de elenco para um clube (Admin)
CREATE OR REPLACE FUNCTION public.gerar_elenco_para_clube(_club_id uuid, _quantidade integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c RECORD;
  v_temp INTEGER;
  i INTEGER;
  positions TEXT[] := ARRAY['GOL','ZAG','ZAG','LD','LE','VOL','VOL','MC','MEI','PD','PE','SA','ATA'];
  pos TEXT;
  age_v INTEGER;
  hab INTEGER;
  pmax INTEGER;
  pmin INTEGER;
  nat TEXT;
  nats TEXT[] := ARRAY['Brasil','Argentina','Portugal','Espanha','França','Alemanha','Inglaterra','Itália','Holanda','Uruguai','Colômbia','México','Chile','Bélgica','Croácia'];
  first_names TEXT[] := ARRAY['Lucas','João','Pedro','Mateo','Diego','Carlos','Marco','Rafael','Felipe','Gabriel','Bruno','Andrés','Sergio','Pablo','Hugo','Iván','Juan','Antonio','Miguel','Nicolas','Tiago','Victor','Eduardo','Adriano','Renato'];
  last_names  TEXT[] := ARRAY['Silva','Santos','Oliveira','Rodríguez','Pereira','Costa','Martínez','García','Fernández','López','Gómez','Souza','Almeida','Cardoso','Ribeiro','Moreira','Nunes','Vidal','Romero','Castro','Vargas','Mendes','Araújo','Correia'];
  affected INTEGER := 0;
  q INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem gerar elencos';
  END IF;

  SELECT * INTO c FROM public.clubs WHERE id = _club_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado'; END IF;

  q := GREATEST(1, LEAST(40, COALESCE(_quantidade, 20)));
  SELECT COALESCE((value->>'ano')::int, 2026) INTO v_temp FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  FOR i IN 1..q LOOP
    pos := positions[1 + floor(random() * array_length(positions, 1))::INTEGER];
    age_v := 17 + floor(random() * 19)::INTEGER; -- 17..35

    -- qualidade tende ao rate do clube (rate 1..5 ~ habilidade média)
    hab := GREATEST(45, LEAST(92,
      ROUND(50 + (COALESCE(c.rate, 2.8) * 5) + (random() * 18 - 9))::INTEGER
    ));

    -- Potencial: jovens podem crescer mais
    IF age_v <= 21 THEN
      pmax := LEAST(94, hab + 4 + floor(random() * 12)::INTEGER);
    ELSIF age_v <= 26 THEN
      pmax := LEAST(94, hab + floor(random() * 6)::INTEGER);
    ELSE
      pmax := LEAST(94, hab + floor(random() * 2)::INTEGER);
    END IF;
    pmin := GREATEST(hab, pmax - (1 + floor(random() * 4)::INTEGER));

    nat := nats[1 + floor(random() * array_length(nats, 1))::INTEGER];

    INSERT INTO public.players (
      club_id, name, position, age, nationality,
      habilidade, potential_min, potential_max, contrato_ate, attributes
    ) VALUES (
      _club_id,
      first_names[1 + floor(random() * array_length(first_names, 1))::INTEGER]
        || ' ' ||
      last_names[1 + floor(random() * array_length(last_names, 1))::INTEGER],
      pos, age_v, nat,
      hab, pmin, pmax,
      v_temp + (1 + floor(random() * 4)::INTEGER),
      jsonb_build_object('origem', 'gerado_admin')
    );
    affected := affected + 1;
  END LOOP;

  RETURN affected;
END;
$$;
