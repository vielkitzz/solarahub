
-- ============ NEW REGION ENUM ============
ALTER TYPE public.external_region RENAME TO external_region_old;
CREATE TYPE public.external_region AS ENUM (
  'america_sul', 'america_norte_central', 'europa', 'asia', 'africa', 'oceania'
);

ALTER TABLE public.external_clubs ALTER COLUMN region DROP DEFAULT;
ALTER TABLE public.external_clubs
  ALTER COLUMN region TYPE public.external_region
  USING (CASE region::text
    WHEN 'europeu' THEN 'europa'
    WHEN 'brasileiro' THEN 'america_sul'
    WHEN 'arabe' THEN 'asia'
    ELSE 'europa'
  END)::public.external_region;
ALTER TABLE public.external_clubs ALTER COLUMN region SET DEFAULT 'europa'::public.external_region;
DROP TYPE public.external_region_old;

-- ============ DROP LEAGUE COLUMN ============
ALTER TABLE public.external_clubs DROP COLUMN IF EXISTS league;

-- ============ UPDATE gerar_propostas_externas ============
CREATE OR REPLACE FUNCTION public.gerar_propostas_externas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ec record;
  pl record;
  temp_atual integer;
  tier_mult numeric;
  v_valor numeric;
  v_salario numeric;
  v_owner uuid;
  total integer := 0;
  ovr_min int;
  ovr_max int;
  cnt int;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem gerar propostas';
  END IF;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  FOR ec IN SELECT * FROM public.external_clubs WHERE active = true LOOP
    tier_mult := CASE ec.budget_tier
      WHEN 'baixo' THEN 0.85
      WHEN 'medio' THEN 1.0
      WHEN 'alto'  THEN 1.25
      WHEN 'elite' THEN 1.6
    END;

    -- Faixa de overall por prestígio
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
        AND NOT EXISTS (
          SELECT 1 FROM public.external_proposals ep
          WHERE ep.player_id = p.id
            AND ep.external_club_id = ec.id
            AND ep.status = 'pendente'
        )
    LOOP
      -- Limite de 2 propostas por jogador por temporada (pendentes ou aceitas)
      SELECT COUNT(*) INTO cnt
      FROM public.external_proposals ep
      WHERE ep.player_id = pl.id
        AND ep.temporada_validade = temp_atual
        AND ep.parent_id IS NULL;
      IF cnt >= 2 THEN CONTINUE; END IF;

      v_valor   := ROUND(pl.valor_base_calculado * (0.8 + ec.prestige * 0.05) * tier_mult);
      v_salario := ROUND(GREATEST(pl.salario_atual, 1) * (1.1 + ec.prestige * 0.03) * tier_mult);
      v_valor := GREATEST(ROUND(pl.valor_base_calculado * 0.55), LEAST(v_valor, ROUND(pl.valor_base_calculado * 4.9)));

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
END $$;

-- ============ UPDATE responder_proposta_externa: keep player tied to external_club ============
CREATE OR REPLACE FUNCTION public.responder_proposta_externa(
  _id uuid, _acao text, _novo_valor numeric DEFAULT NULL, _novo_salario numeric DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pr record;
  pl record;
  cl record;
  ec record;
  total_devido numeric;
  v_temp integer;
  nova_id uuid;
  cnt int;
BEGIN
  SELECT * INTO pr FROM public.external_proposals WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF pr.status <> 'pendente' THEN RAISE EXCEPTION 'Proposta já processada'; END IF;

  SELECT * INTO pl FROM public.players WHERE id = pr.player_id;
  SELECT * INTO cl FROM public.clubs WHERE id = pl.club_id;
  SELECT * INTO ec FROM public.external_clubs WHERE id = pr.external_club_id;

  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR cl.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO v_temp FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  IF _acao = 'aceitar' THEN
    total_devido := pr.valor_ofertado + pr.luvas;
    UPDATE public.clubs SET budget = budget + total_devido WHERE id = pl.club_id;
    -- Mantém o jogador no banco vinculado ao clube estrangeiro (não vira passe livre)
    UPDATE public.players
      SET club_id = NULL,
          external_club_id = ec.id,
          a_venda = false,
          salario_atual = 0,
          contrato_ate = NULL
      WHERE id = pl.id;
    UPDATE public.external_proposals SET status = 'aceita' WHERE id = _id;
    UPDATE public.external_proposals SET status = 'recusada'
      WHERE player_id = pl.id AND id <> _id AND status = 'pendente';

    INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, related_player_id, temporada, metadata)
    VALUES (pl.club_id, 'entrada', 'transferencia_externa', total_devido,
            'Venda de ' || pl.name || ' para ' || ec.name || ' (' || COALESCE(ec.country,'') || ')',
            pl.id, v_temp,
            jsonb_build_object('external_club_id', ec.id, 'valor', pr.valor_ofertado, 'luvas', pr.luvas));
    RETURN _id;

  ELSIF _acao = 'recusar' THEN
    UPDATE public.external_proposals SET status = 'recusada' WHERE id = _id;
    UPDATE public.players
      SET attributes = COALESCE(attributes, '{}'::jsonb) ||
          jsonb_build_object('propostas_recusadas',
            (COALESCE((attributes->>'propostas_recusadas')::int, 0) + 1))
      WHERE id = pl.id;
    RETURN _id;

  ELSIF _acao = 'contraproposta' THEN
    IF _novo_valor IS NULL OR _novo_salario IS NULL THEN
      RAISE EXCEPTION 'Valor e salário obrigatórios para contraproposta';
    END IF;
    UPDATE public.external_proposals SET status = 'contraproposta' WHERE id = _id;
    INSERT INTO public.external_proposals(external_club_id, player_id, valor_ofertado, salario_ofertado,
      luvas, status, temporada_validade, parent_id, origem)
    VALUES (pr.external_club_id, pr.player_id, _novo_valor, _novo_salario,
      pr.luvas, 'pendente', pr.temporada_validade, pr.id, 'user_counter')
    RETURNING id INTO nova_id;
    RETURN nova_id;
  ELSE
    RAISE EXCEPTION 'Ação inválida';
  END IF;
END $$;
