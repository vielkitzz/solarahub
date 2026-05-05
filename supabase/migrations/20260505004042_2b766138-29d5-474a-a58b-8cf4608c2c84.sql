-- 1) Premiação por temporada/clube via Campanhas (resultados x premiações)
CREATE OR REPLACE FUNCTION public.premiacao_clube_temporada(_club_id uuid, _temp integer)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(pt.valor), 0)::numeric
  FROM public.resultados_temporada rt
  JOIN public.premiacoes_torneio pt
    ON pt.torneio = rt.torneio
   AND lower(trim(pt.fase)) = lower(trim(COALESCE(rt.fase, '')))
  WHERE rt.clube_id = _club_id
    AND rt.temporada = _temp;
$$;

-- 2) preview_season_turnover usando a nova função
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
  temp_atual INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem ver a prévia';
  END IF;
  SELECT value INTO econ FROM public.settings WHERE key = 'economia_params' LIMIT 1;
  manut_por_nivel := COALESCE((econ->>'manutencao_por_nivel_base')::numeric, 300000);
  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' ORDER BY name LOOP
    rb := public.get_tv_rights_value(c.id);
    preco_medio := (COALESCE(c.preco_ingresso_nacional, 0) + COALESCE(c.preco_ingresso_internacional, 0)) / 2.0;
    jogos := COALESCE(c.jogos_por_temporada, 38);
    bilh := COALESCE(c.stadium_capacity, 0) * 0.85 * preco_medio * jogos * (c.rate / 3.0);
    manut := c.nivel_base * manut_por_nivel;
    prem := public.premiacao_clube_temporada(c.id, temp_atual);
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

-- 3) process_season_turnover idem + registro de transactions (premiação, salário, manut., contratos, bilheteria, TV)
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
  econ JSONB;
  manut_por_nivel NUMERIC;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar a virada de temporada';
  END IF;

  SELECT value INTO econ FROM public.settings WHERE key = 'economia_params' LIMIT 1;
  manut_por_nivel := COALESCE((econ->>'manutencao_por_nivel_base')::numeric, 300000);

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;
  nova_temp := temp_atual + 1;

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' LOOP
    v_tv := public.get_tv_rights_value(c.id);
    preco_medio := (COALESCE(c.preco_ingresso_nacional, 0) + COALESCE(c.preco_ingresso_internacional, 0)) / 2.0;
    jogos := COALESCE(c.jogos_por_temporada, 38);
    bilheteria := COALESCE(c.stadium_capacity, 0) * 0.85 * preco_medio * jogos * (c.rate / 3.0);
    manutencao := c.nivel_base * manut_por_nivel;
    premiacao := public.premiacao_clube_temporada(c.id, temp_atual);

    SELECT COALESCE(SUM(salario_atual), 0) INTO folha
      FROM public.players WHERE players.club_id = c.id;

    SELECT COALESCE(SUM(valor_anual), 0) INTO contratos
      FROM public.contratos_clube
      WHERE contratos_clube.club_id = c.id AND ativo = true;

    total_delta := v_tv + bilheteria + contratos + premiacao - manutencao - folha;

    UPDATE public.clubs SET budget = budget + total_delta WHERE id = c.id;

    -- Registros financeiros agregados da temporada
    IF v_tv > 0 THEN
      INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, temporada)
      VALUES (c.id, 'entrada', 'tv', v_tv, 'Direitos de TV (temp ' || temp_atual || ')', temp_atual);
    END IF;
    IF bilheteria > 0 THEN
      INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, temporada)
      VALUES (c.id, 'entrada', 'bilheteria', bilheteria, 'Bilheteria anual (temp ' || temp_atual || ')', temp_atual);
    END IF;
    IF contratos > 0 THEN
      INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, temporada)
      VALUES (c.id, 'entrada', 'patrocinio', contratos, 'Patrocínios anuais (temp ' || temp_atual || ')', temp_atual);
    END IF;
    IF premiacao > 0 THEN
      INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, temporada)
      VALUES (c.id, 'entrada', 'premiacao', premiacao, 'Premiações de torneios (temp ' || temp_atual || ')', temp_atual);
    END IF;
    IF manutencao > 0 THEN
      INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, temporada)
      VALUES (c.id, 'saida', 'manutencao', manutencao, 'Manutenção de base/estádio (temp ' || temp_atual || ')', temp_atual);
    END IF;
    IF folha > 0 THEN
      INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, temporada)
      VALUES (c.id, 'saida', 'salario', folha, 'Folha salarial (temp ' || temp_atual || ')', temp_atual);
    END IF;

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