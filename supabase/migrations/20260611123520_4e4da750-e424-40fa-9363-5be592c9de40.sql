
CREATE OR REPLACE FUNCTION public.fn_gerar_proposta_ao_colocar_a_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_temp        INTEGER;
  v_total_props INTEGER;
  v_target      INTEGER;
  v_to_create   INTEGER;
  v_club        RECORD;
  v_valor       NUMERIC;
  v_salario     NUMERIC;
  v_tier_mult   NUMERIC;
  v_candidatos  UUID[];
  v_ec_id       UUID;
BEGIN
  IF NOT (OLD.a_venda IS DISTINCT FROM NEW.a_venda AND NEW.a_venda = true) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.valor_base_calculado, 0) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO v_temp
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  SELECT COUNT(*) INTO v_total_props
  FROM public.external_proposals
  WHERE player_id = NEW.id
    AND temporada_validade = v_temp
    AND parent_id IS NULL;

  -- Alvo aleatório de 0 a 2 propostas por temporada
  v_target := floor(random() * 3)::int;  -- 0, 1 ou 2
  v_to_create := GREATEST(0, v_target - v_total_props);

  IF v_to_create = 0 THEN
    RETURN NEW;
  END IF;

  SELECT ARRAY(
    SELECT ec.id
    FROM public.external_clubs ec
    WHERE ec.active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.external_proposals ep
        WHERE ep.player_id = NEW.id
          AND ep.external_club_id = ec.id
          AND ep.status = 'pendente'
          AND ep.temporada_validade = v_temp
      )
      AND NOT (ec.prestige > 5 AND COALESCE(NEW.habilidade, 0) < 69)
    ORDER BY random()
    LIMIT v_to_create
  ) INTO v_candidatos;

  FOREACH v_ec_id IN ARRAY v_candidatos LOOP
    SELECT * INTO v_club FROM public.external_clubs WHERE id = v_ec_id;

    v_tier_mult := CASE v_club.budget_tier
      WHEN 'baixo' THEN 0.85
      WHEN 'medio' THEN 1.0
      WHEN 'alto'  THEN 1.25
      WHEN 'elite' THEN 1.6
      ELSE 1.0
    END;

    v_valor := ROUND(
      NEW.valor_base_calculado
      * (0.80 + v_club.prestige * 0.05)
      * v_tier_mult
    );
    v_valor := GREATEST(
      ROUND(NEW.valor_base_calculado * 0.55),
      LEAST(v_valor, ROUND(NEW.valor_base_calculado * 4.9))
    );

    v_salario := ROUND(
      GREATEST(COALESCE(NEW.salario_atual, 1), 1)
      * (1.10 + v_club.prestige * 0.03)
      * v_tier_mult
    );

    INSERT INTO public.external_proposals (
      external_club_id, player_id, valor_ofertado, salario_ofertado,
      temporada_validade, origem, is_auto_proposal
    ) VALUES (
      v_ec_id, NEW.id, v_valor, v_salario, v_temp, 'a_venda_toggle', true
    );
  END LOOP;

  RETURN NEW;
END;
$function$;
