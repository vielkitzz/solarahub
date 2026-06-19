CREATE OR REPLACE FUNCTION public.responder_proposta_externa(_id uuid, _acao text, _novo_valor numeric DEFAULT NULL::numeric, _novo_salario numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pr record; pl record; cl record; ec record;
  total_devido numeric; v_temp integer; nova_id uuid; ai_id uuid;
  v_vendas int;
  v_vbase numeric; v_max_fp numeric; v_anterior numeric; v_pedido numeric;
  v_ratio numeric; v_novo numeric; v_msg text; v_status text;
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
    SELECT vendas INTO v_vendas FROM public.club_transfer_counts(pl.club_id);
    IF COALESCE(v_vendas,0) >= 12 AND NOT has_role(auth.uid(),'admin'::app_role) THEN
      RAISE EXCEPTION 'Clube atingiu o limite de 12 vendas nesta temporada';
    END IF;

    total_devido := pr.valor_ofertado + pr.luvas;
    UPDATE public.clubs SET budget = budget + total_devido WHERE id = pl.club_id;
    UPDATE public.players
      SET club_id = NULL, external_club_id = ec.id, a_venda = false,
          salario_atual = 0, contrato_ate = NULL
      WHERE id = pl.id;
    UPDATE public.external_proposals SET status = 'aceita' WHERE id = _id;
    UPDATE public.external_proposals SET status = 'recusada'
      WHERE player_id = pl.id AND id <> _id AND status IN ('pendente','aguardando_ia');

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

    -- Marca a oferta original como respondida (contraproposta)
    UPDATE public.external_proposals SET status = 'contraproposta' WHERE id = _id;

    -- Registra a contraproposta do usuário (fechada como histórico)
    INSERT INTO public.external_proposals(external_club_id, player_id, valor_ofertado, salario_ofertado,
      luvas, status, temporada_validade, parent_id, origem)
    VALUES (pr.external_club_id, pr.player_id, _novo_valor, _novo_salario,
      pr.luvas, 'contraproposta', pr.temporada_validade, pr.id, 'user_counter')
    RETURNING id INTO nova_id;

    -- Decisão INSTANTÂNEA do clube comprador (sem chamar IA externa)
    v_vbase    := COALESCE(pl.valor_base_calculado, 0);
    v_max_fp   := v_vbase * 5.0;            -- teto Fair Play externo (500%)
    v_anterior := pr.valor_ofertado;        -- última oferta do clube comprador
    v_pedido   := _novo_valor;              -- pedido atual do vendedor
    v_ratio    := CASE WHEN v_vbase > 0 THEN v_pedido / v_vbase ELSE 1 END;

    -- Teto de segurança: nunca chegar ao máximo do Fair Play (usa no máx. 90% do teto)
    v_max_fp := v_max_fp * 0.9;

    IF v_pedido <= v_anterior OR v_ratio <= 1.20 THEN
      -- Aceita: clube comprador concorda com o pedido. Cria nova "pendente" no valor do pedido
      -- para o usuário confirmar formalmente clicando em Aceitar.
      INSERT INTO public.external_proposals(external_club_id, player_id, valor_ofertado, salario_ofertado,
        luvas, status, temporada_validade, parent_id, origem, mensagem)
      VALUES (pr.external_club_id, pr.player_id, LEAST(v_pedido, v_max_fp), _novo_salario,
        pr.luvas, 'pendente', pr.temporada_validade, nova_id, 'ai_counter',
        ec.name || ' aceitou os termos. Confirme para fechar o acordo.')
      RETURNING id INTO ai_id;
      RETURN ai_id;

    ELSIF v_ratio >= 1.60 OR v_pedido > v_max_fp THEN
      -- Recusa: pedido fora de alcance / acima do teto seguro de Fair Play
      v_msg := ec.name || ' recusou: o valor pedido está acima do que o clube pode pagar dentro do Fair Play.';
      INSERT INTO public.external_proposals(external_club_id, player_id, valor_ofertado, salario_ofertado,
        luvas, status, temporada_validade, parent_id, origem, mensagem)
      VALUES (pr.external_club_id, pr.player_id, v_pedido, _novo_salario,
        pr.luvas, 'recusada', pr.temporada_validade, nova_id, 'ai_counter', v_msg);
      RETURN nova_id;

    ELSE
      -- Contra-oferta intermediária, garantindo > oferta anterior e <= 90% do teto FP
      v_novo := ROUND((v_anterior + v_pedido) / 2);
      v_novo := LEAST(v_novo, FLOOR(v_max_fp));
      v_novo := LEAST(v_novo, v_pedido);
      IF v_novo <= v_anterior THEN
        v_msg := ec.name || ' recusou: não há margem para subir sem ultrapassar o limite de Fair Play.';
        INSERT INTO public.external_proposals(external_club_id, player_id, valor_ofertado, salario_ofertado,
          luvas, status, temporada_validade, parent_id, origem, mensagem)
        VALUES (pr.external_club_id, pr.player_id, v_pedido, _novo_salario,
          pr.luvas, 'recusada', pr.temporada_validade, nova_id, 'ai_counter', v_msg);
        RETURN nova_id;
      END IF;
      v_msg := ec.name || ' não chega ao valor pedido, mas pode subir para ' || v_novo::text || '.';
      INSERT INTO public.external_proposals(external_club_id, player_id, valor_ofertado, salario_ofertado,
        luvas, status, temporada_validade, parent_id, origem, mensagem)
      VALUES (pr.external_club_id, pr.player_id, v_novo, _novo_salario,
        pr.luvas, 'pendente', pr.temporada_validade, nova_id, 'ai_counter', v_msg)
      RETURNING id INTO ai_id;
      RETURN ai_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Ação inválida';
  END IF;
END $function$;