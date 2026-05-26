
-- 1) Limite de 2 multas rescisórias pagas por um clube por jogador de outro clube
CREATE OR REPLACE FUNCTION public.pagar_multa_rescisoria(_jogador_id uuid, _clube_comprador_id uuid, _novo_salario numeric, _anos_contrato integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  multa NUMERIC;
  caixa_comp NUMERIC;
  temp_atual INTEGER;
  v_owner_atual UUID;
  v_clube_atual_nome TEXT;
  v_clube_comp_nome TEXT;
  v_clube_atual_id UUID;
  v_multas_pagas INTEGER;
BEGIN
  SELECT * INTO p FROM public.players WHERE id = _jogador_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;
  IF p.club_id IS NULL THEN RAISE EXCEPTION 'Jogador é agente livre, não tem multa'; END IF;
  IF p.club_id = _clube_comprador_id THEN RAISE EXCEPTION 'Clube já é o dono do jogador'; END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.clubs WHERE id = _clube_comprador_id AND owner_id = auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- Limite: este clube comprador já pagou no máximo 2 multas por este jogador
  SELECT COUNT(*) INTO v_multas_pagas
    FROM public.transactions
    WHERE club_id = _clube_comprador_id
      AND related_player_id = _jogador_id
      AND categoria = 'multa_rescisoria'
      AND tipo = 'saida';
  IF v_multas_pagas >= 2 THEN
    RAISE EXCEPTION 'Limite de 2 multas rescisórias pagas por este clube para este jogador atingido';
  END IF;

  multa := ROUND(COALESCE(p.valor_base_calculado, 0) * 7);
  IF multa <= 0 THEN RAISE EXCEPTION 'Multa inválida (valor base zero)'; END IF;

  SELECT budget INTO caixa_comp FROM public.clubs WHERE id = _clube_comprador_id FOR UPDATE;
  IF caixa_comp < multa THEN
    RAISE EXCEPTION 'Caixa insuficiente. Necessário % para pagar a multa.', multa;
  END IF;

  v_clube_atual_id := p.club_id;
  SELECT owner_id, name INTO v_owner_atual, v_clube_atual_nome FROM public.clubs WHERE id = v_clube_atual_id;
  SELECT name INTO v_clube_comp_nome FROM public.clubs WHERE id = _clube_comprador_id;
  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  UPDATE public.clubs SET budget = budget - multa WHERE id = _clube_comprador_id;
  UPDATE public.clubs SET budget = budget + multa WHERE id = v_clube_atual_id;

  UPDATE public.players
    SET club_id = _clube_comprador_id, salario_atual = _novo_salario,
        contrato_ate = temp_atual + GREATEST(_anos_contrato, 1), a_venda = false
    WHERE id = _jogador_id;

  IF v_owner_atual IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, club_id, tipo, titulo, mensagem, payload)
    VALUES(v_owner_atual, v_clube_atual_id, 'multa_paga', 'Multa paga: ' || p.name,
      'O ' || v_clube_comp_nome || ' pagou a multa rescisória de ' || multa::text || ' para tirar ' || p.name || ' do seu clube.',
      jsonb_build_object('player_name', p.name, 'multa', multa, 'comprador', v_clube_comp_nome));
  END IF;

  INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, related_player_id, related_club_id, temporada, metadata)
  VALUES
    (_clube_comprador_id, 'saida', 'multa_rescisoria', multa,
     'Multa rescisória paga por ' || p.name || ' (' || v_clube_atual_nome || ')',
     _jogador_id, v_clube_atual_id, temp_atual, jsonb_build_object('multa', multa)),
    (v_clube_atual_id, 'entrada', 'multa_rescisoria', multa,
     'Multa rescisória recebida por ' || p.name || ' (' || v_clube_comp_nome || ')',
     _jogador_id, _clube_comprador_id, temp_atual, jsonb_build_object('multa', multa));

  RETURN jsonb_build_object('multa', multa, 'jogador', p.name);
END;
$function$;

-- 2) RPC: encerrar empréstimo pagando 2x salário (dono original chama jogador de volta)
CREATE OR REPLACE FUNCTION public.encerrar_emprestimo(_jogador_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  t RECORD;
  multa NUMERIC;
  temp_atual INTEGER;
  v_origem_nome TEXT;
  v_atual_nome TEXT;
  v_owner_atual UUID;
BEGIN
  SELECT * INTO p FROM public.players WHERE id = _jogador_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;

  SELECT * INTO t FROM public.transferencias
    WHERE jogador_id = _jogador_id AND tipo = 'emprestimo' AND status = 'aceita'
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador não está emprestado'; END IF;

  IF NOT (has_role(auth.uid(),'admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.clubs WHERE id = t.clube_vendedor_id AND owner_id = auth.uid())) THEN
    RAISE EXCEPTION 'Apenas o clube de origem pode encerrar o empréstimo';
  END IF;

  multa := ROUND(COALESCE(p.salario_atual,0) * 2);
  IF (SELECT budget FROM public.clubs WHERE id = t.clube_vendedor_id) < multa THEN
    RAISE EXCEPTION 'Caixa insuficiente. Necessário % para encerrar o empréstimo.', multa;
  END IF;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual FROM public.settings WHERE key='temporada_atual' LIMIT 1;
  SELECT name INTO v_origem_nome FROM public.clubs WHERE id = t.clube_vendedor_id;
  SELECT name, owner_id INTO v_atual_nome, v_owner_atual FROM public.clubs WHERE id = t.clube_comprador_id;

  -- Paga multa
  UPDATE public.clubs SET budget = budget - multa WHERE id = t.clube_vendedor_id;
  UPDATE public.clubs SET budget = budget + multa WHERE id = t.clube_comprador_id;

  -- Volta o jogador
  UPDATE public.players SET club_id = t.clube_vendedor_id, a_venda = false WHERE id = _jogador_id;

  -- Finaliza transferência
  UPDATE public.transferencias SET status = 'finalizada' WHERE id = t.id;

  INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,related_player_id,related_club_id,temporada)
  VALUES
    (t.clube_vendedor_id,'saida','emprestimo_encerramento',multa,
      'Encerramento antecipado de empréstimo: ' || p.name || ' (multa)', _jogador_id, t.clube_comprador_id, temp_atual),
    (t.clube_comprador_id,'entrada','emprestimo_encerramento',multa,
      'Recebido por encerramento antecipado: ' || p.name, _jogador_id, t.clube_vendedor_id, temp_atual);

  IF v_owner_atual IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, club_id, tipo, titulo, mensagem, payload)
    VALUES(v_owner_atual, t.clube_comprador_id, 'emprestimo_encerrado', 'Empréstimo encerrado: ' || p.name,
      v_origem_nome || ' chamou ' || p.name || ' de volta pagando ' || multa::text || ' de multa.',
      jsonb_build_object('player_name', p.name, 'multa', multa));
  END IF;

  RETURN jsonb_build_object('multa', multa, 'jogador', p.name);
END;
$function$;

-- 3) RPC: dono original define/altera opção de compra de um empréstimo ativo
CREATE OR REPLACE FUNCTION public.definir_opcao_compra_emprestimo(_jogador_id uuid, _valor numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t RECORD;
BEGIN
  SELECT * INTO t FROM public.transferencias
    WHERE jogador_id = _jogador_id AND tipo = 'emprestimo' AND status = 'aceita'
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador não está emprestado'; END IF;

  IF NOT (has_role(auth.uid(),'admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.clubs WHERE id = t.clube_vendedor_id AND owner_id = auth.uid())) THEN
    RAISE EXCEPTION 'Apenas o clube de origem pode definir a opção de compra';
  END IF;
  IF _valor < 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;

  UPDATE public.transferencias SET opcao_compra = _valor WHERE id = t.id;
  RETURN jsonb_build_object('opcao_compra', _valor);
END;
$function$;

-- 4) RPC: clube atual executa a opção de compra do jogador emprestado
CREATE OR REPLACE FUNCTION public.executar_opcao_compra_emprestimo(_jogador_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD; t RECORD;
  valor NUMERIC; temp_atual INTEGER;
  v_origem_nome TEXT; v_atual_nome TEXT; v_owner_origem UUID;
BEGIN
  SELECT * INTO p FROM public.players WHERE id = _jogador_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;

  SELECT * INTO t FROM public.transferencias
    WHERE jogador_id = _jogador_id AND tipo = 'emprestimo' AND status = 'aceita'
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador não está emprestado'; END IF;

  IF NOT (has_role(auth.uid(),'admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.clubs WHERE id = t.clube_comprador_id AND owner_id = auth.uid())) THEN
    RAISE EXCEPTION 'Apenas o clube atual pode executar a opção de compra';
  END IF;

  valor := COALESCE(t.opcao_compra, 0);
  IF valor <= 0 THEN RAISE EXCEPTION 'Sem opção de compra definida'; END IF;
  IF (SELECT budget FROM public.clubs WHERE id = t.clube_comprador_id) < valor THEN
    RAISE EXCEPTION 'Caixa insuficiente. Necessário % para executar a opção.', valor;
  END IF;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual FROM public.settings WHERE key='temporada_atual' LIMIT 1;
  SELECT name, owner_id INTO v_origem_nome, v_owner_origem FROM public.clubs WHERE id = t.clube_vendedor_id;
  SELECT name INTO v_atual_nome FROM public.clubs WHERE id = t.clube_comprador_id;

  UPDATE public.clubs SET budget = budget - valor WHERE id = t.clube_comprador_id;
  UPDATE public.clubs SET budget = budget + valor WHERE id = t.clube_vendedor_id;

  UPDATE public.players SET club_id = t.clube_comprador_id,
      contrato_ate = GREATEST(COALESCE(contrato_ate, temp_atual+3), temp_atual + 3),
      a_venda = false
    WHERE id = _jogador_id;

  UPDATE public.transferencias SET status = 'finalizada' WHERE id = t.id;

  INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,related_player_id,related_club_id,temporada)
  VALUES
    (t.clube_comprador_id,'saida','opcao_compra',valor,
      'Opção de compra exercida: ' || p.name || ' (' || v_origem_nome || ')', _jogador_id, t.clube_vendedor_id, temp_atual),
    (t.clube_vendedor_id,'entrada','opcao_compra',valor,
      'Opção de compra recebida: ' || p.name || ' (' || v_atual_nome || ')', _jogador_id, t.clube_comprador_id, temp_atual);

  IF v_owner_origem IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, club_id, tipo, titulo, mensagem, payload)
    VALUES(v_owner_origem, t.clube_vendedor_id, 'opcao_compra_exercida', 'Opção de compra exercida: ' || p.name,
      v_atual_nome || ' exerceu a opção de compra de ' || p.name || ' por ' || valor::text || '.',
      jsonb_build_object('player_name', p.name, 'valor', valor));
  END IF;

  RETURN jsonb_build_object('valor', valor, 'jogador', p.name);
END;
$function$;
