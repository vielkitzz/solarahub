
-- Helper: conta compras e vendas (excluindo empréstimos) do clube na temporada atual
CREATE OR REPLACE FUNCTION public.club_transfer_counts(_club_id uuid)
RETURNS TABLE(compras int, vendas int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_temp int;
BEGIN
  SELECT COALESCE((value->>'ano')::int, 2026) INTO v_temp FROM public.settings WHERE key='temporada_atual' LIMIT 1;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::int FROM public.transactions t
      WHERE t.club_id=_club_id AND t.tipo='saida' AND t.categoria='transferencia'
        AND (t.descricao ILIKE 'Compra de%' OR t.descricao ILIKE 'Pagamento por%' OR t.descricao ILIKE 'Contratação de%')
        AND t.temporada=v_temp
        AND COALESCE(t.metadata->>'tipo_op','') <> 'emprestimo'),
    (SELECT COUNT(*)::int FROM public.transactions t
      WHERE t.club_id=_club_id AND t.tipo='entrada'
        AND t.categoria IN ('transferencia','transferencia_externa')
        AND t.descricao ILIKE 'Venda de%'
        AND t.temporada=v_temp
        AND COALESCE(t.metadata->>'tipo_op','') <> 'emprestimo');
END $$;

GRANT EXECUTE ON FUNCTION public.club_transfer_counts(uuid) TO authenticated, anon, service_role;

-- Atualiza fn_check_transfer_window adicionando o limite de 12 compras/vendas por temporada
CREATE OR REPLACE FUNCTION public.fn_check_transfer_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  win JSONB; v_open boolean; v_ban_c boolean; v_ban_v boolean;
  v_player RECORD; v_on_loan boolean;
  v_c_compras int; v_v_vendas int;
BEGIN
  IF has_role(auth.uid(),'admin'::app_role) THEN RETURN NEW; END IF;

  SELECT value INTO win FROM public.settings WHERE key = 'transfer_window' LIMIT 1;
  v_open := COALESCE((win->>'open')::boolean, true);
  IF NOT v_open THEN
    RAISE EXCEPTION 'Janela de transferências está fechada';
  END IF;

  SELECT transfer_ban INTO v_ban_c FROM public.clubs WHERE id = NEW.clube_comprador_id;
  IF COALESCE(v_ban_c,false) THEN
    RAISE EXCEPTION 'Clube comprador está com transferban';
  END IF;

  IF NEW.clube_vendedor_id IS NOT NULL THEN
    SELECT transfer_ban INTO v_ban_v FROM public.clubs WHERE id = NEW.clube_vendedor_id;
    IF COALESCE(v_ban_v,false) THEN
      RAISE EXCEPTION 'Clube vendedor está com transferban';
    END IF;
  END IF;

  -- Limite de 12 compras/vendas por temporada (não vale para empréstimos)
  IF COALESCE(NEW.tipo,'compra') <> 'emprestimo' THEN
    SELECT compras INTO v_c_compras FROM public.club_transfer_counts(NEW.clube_comprador_id);
    IF COALESCE(v_c_compras,0) >= 12 THEN
      RAISE EXCEPTION 'Clube comprador atingiu o limite de 12 contratações nesta temporada';
    END IF;
    IF NEW.clube_vendedor_id IS NOT NULL THEN
      SELECT vendas INTO v_v_vendas FROM public.club_transfer_counts(NEW.clube_vendedor_id);
      IF COALESCE(v_v_vendas,0) >= 12 THEN
        RAISE EXCEPTION 'Clube vendedor atingiu o limite de 12 vendas nesta temporada';
      END IF;
    END IF;
  END IF;

  -- Checa estado do jogador alvo
  SELECT id, club_id, external_club_id, bloquear_propostas
    INTO v_player FROM public.players WHERE id = NEW.jogador_id;

  IF v_player.id IS NOT NULL THEN
    IF COALESCE(v_player.bloquear_propostas, false) THEN
      RAISE EXCEPTION 'Este jogador está com propostas bloqueadas pelo clube';
    END IF;

    IF v_player.external_club_id IS NOT NULL AND v_player.club_id IS NULL THEN
      RAISE EXCEPTION 'Jogador vendido para o exterior não está disponível para propostas';
    END IF;

    IF v_player.club_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.transferencias t
        WHERE t.jogador_id = v_player.id
          AND t.tipo = 'emprestimo'
          AND t.status = 'aceita'
          AND t.clube_comprador_id = v_player.club_id
      ) INTO v_on_loan;
      IF v_on_loan THEN
        RAISE EXCEPTION 'Jogador emprestado não pode receber propostas até o fim do empréstimo';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Bloqueia confirmação se limite foi atingido entre a oferta e a aceitação
CREATE OR REPLACE FUNCTION public.fn_check_transfer_limit_on_confirm()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_c int; v_v int;
BEGIN
  IF NEW.status='aguardando_confirmacao' AND OLD.status<>'aguardando_confirmacao'
     AND COALESCE(NEW.tipo,'compra') <> 'emprestimo'
     AND NOT has_role(auth.uid(),'admin'::app_role) THEN
    SELECT compras INTO v_c FROM public.club_transfer_counts(NEW.clube_comprador_id);
    IF COALESCE(v_c,0) >= 12 THEN
      RAISE EXCEPTION 'Clube comprador atingiu o limite de 12 contratações nesta temporada';
    END IF;
    IF NEW.clube_vendedor_id IS NOT NULL THEN
      SELECT vendas INTO v_v FROM public.club_transfer_counts(NEW.clube_vendedor_id);
      IF COALESCE(v_v,0) >= 12 THEN
        RAISE EXCEPTION 'Clube vendedor atingiu o limite de 12 vendas nesta temporada';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_check_transfer_limit_confirm ON public.transferencias;
CREATE TRIGGER tg_check_transfer_limit_confirm
BEFORE UPDATE OF status ON public.transferencias
FOR EACH ROW EXECUTE FUNCTION public.fn_check_transfer_limit_on_confirm();

-- Bloqueia venda externa (responder_proposta_externa) ao aceitar quando atingiu 12 vendas
CREATE OR REPLACE FUNCTION public.responder_proposta_externa(_id uuid, _acao text, _novo_valor numeric DEFAULT NULL::numeric, _novo_salario numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pr record; pl record; cl record; ec record;
  total_devido numeric; v_temp integer; nova_id uuid;
  v_vendas int;
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
END $function$;
