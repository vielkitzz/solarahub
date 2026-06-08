CREATE OR REPLACE FUNCTION public.gerar_propostas_externas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ec record; pl record;
  temp_atual integer; tier_mult numeric;
  v_valor numeric; v_salario numeric;
  v_owner uuid; total integer := 0;
  ovr_min int; ovr_max int; cnt int;
  cap int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem gerar propostas';
  END IF;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  FOR ec IN SELECT * FROM public.external_clubs WHERE active = true LOOP
    tier_mult := CASE ec.budget_tier
      WHEN 'baixo' THEN 0.85 WHEN 'medio' THEN 1.0
      WHEN 'alto'  THEN 1.25 WHEN 'elite' THEN 1.6
    END;

    IF ec.prestige >= 9 THEN ovr_min := 89; ovr_max := 99;
    ELSIF ec.prestige = 8 THEN ovr_min := 84; ovr_max := 88;
    ELSIF ec.prestige = 7 THEN ovr_min := 79; ovr_max := 83;
    ELSIF ec.prestige = 6 THEN ovr_min := 74; ovr_max := 78;
    ELSIF ec.prestige = 5 THEN ovr_min := 69; ovr_max := 73;
    ELSIF ec.prestige = 4 THEN ovr_min := 64; ovr_max := 68;
    ELSIF ec.prestige = 3 THEN ovr_min := 59; ovr_max := 63;
    ELSIF ec.prestige = 2 THEN ovr_min := 54; ovr_max := 58;
    ELSE ovr_min := 45; ovr_max := 53;
    END IF;

    FOR pl IN
      SELECT p.* FROM public.players p
      JOIN public.clubs c ON c.id = p.club_id
      WHERE c.owner_id IS NOT NULL
        AND p.valor_base_calculado > 0
        AND p.habilidade BETWEEN ovr_min AND ovr_max
        AND COALESCE(p.bloquear_propostas, false) = false
        AND (COALESCE(p.a_venda, false) = true OR p.habilidade >= 84)
        AND NOT EXISTS (
          SELECT 1 FROM public.external_proposals ep
          WHERE ep.player_id = p.id
            AND ep.external_club_id = ec.id
            AND ep.status = 'pendente'
        )
    LOOP
      cap := floor(random() * 3)::int;
      IF cap = 0 THEN CONTINUE; END IF;

      SELECT COUNT(*) INTO cnt
      FROM public.external_proposals ep
      WHERE ep.player_id = pl.id
        AND ep.temporada_validade = temp_atual
        AND ep.parent_id IS NULL;
      IF cnt >= cap THEN CONTINUE; END IF;

      v_valor   := ROUND(pl.valor_base_calculado * (0.8 + ec.prestige * 0.05) * tier_mult);
      v_salario := ROUND(GREATEST(pl.salario_atual, 1) * (1.1 + ec.prestige * 0.03) * tier_mult);
      v_valor   := GREATEST(ROUND(pl.valor_base_calculado * 0.55), LEAST(v_valor, ROUND(pl.valor_base_calculado * 4.9)));

      BEGIN
        INSERT INTO public.external_proposals(external_club_id, player_id, valor_ofertado, salario_ofertado, temporada_validade)
        VALUES (ec.id, pl.id, v_valor, v_salario, temp_atual);
        total := total + 1;

        SELECT owner_id INTO v_owner FROM public.clubs WHERE id = pl.club_id;
        IF v_owner IS NOT NULL THEN
          INSERT INTO public.notifications(user_id, club_id, tipo, titulo, mensagem, payload)
          VALUES (v_owner, pl.club_id, 'proposta_externa',
            'Proposta de ' || ec.name,
            ec.name || ' fez uma oferta por ' || pl.name || ' no valor de ' || v_valor::text,
            jsonb_build_object('external_club_id', ec.id, 'player_id', pl.id, 'valor', v_valor));
        END IF;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;
    END LOOP;
  END LOOP;

  RETURN total;
END;
$function$;