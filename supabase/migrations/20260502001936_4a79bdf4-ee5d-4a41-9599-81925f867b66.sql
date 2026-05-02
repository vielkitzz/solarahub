
-- 1. TABELA transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria TEXT NOT NULL, -- transferencia, upgrade_estadio, upgrade_base, multa_rescisoria, emprestimo, amortizacao, salario, premiacao, patrocinio, bilheteria, tv, manutencao, outros
  valor NUMERIC NOT NULL DEFAULT 0,
  descricao TEXT NOT NULL,
  related_player_id UUID,
  related_club_id UUID,
  temporada INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_club ON public.transactions(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_categoria ON public.transactions(categoria);
CREATE INDEX IF NOT EXISTS idx_transactions_temporada ON public.transactions(temporada);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view transactions"
  ON public.transactions FOR SELECT
  USING (true);

CREATE POLICY "Owner or admin insert transaction"
  ON public.transactions FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE id = transactions.club_id AND owner_id = auth.uid())
  );

CREATE POLICY "Admin update/delete transactions"
  ON public.transactions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete transactions"
  ON public.transactions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. accept_transfer com registro automático
CREATE OR REPLACE FUNCTION public.accept_transfer(_transfer_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t RECORD;
  comprador_caixa NUMERIC;
  total_devido NUMERIC;
  is_contra BOOLEAN;
  v_player_name TEXT;
  v_comp_name TEXT;
  v_vend_name TEXT;
  v_temp INTEGER;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF t.status <> 'pendente' THEN RAISE EXCEPTION 'Proposta já processada'; END IF;

  is_contra := t.proposta_pai_id IS NOT NULL;

  IF is_contra THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.clubs WHERE id = t.clube_comprador_id AND owner_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'Sem permissão para aceitar essa contraproposta';
    END IF;
  ELSE
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.clubs WHERE id = t.clube_vendedor_id AND owner_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'Sem permissão para aceitar essa proposta';
    END IF;
  END IF;

  total_devido := COALESCE(t.valor_ofertado, 0) + COALESCE(t.luvas, 0);

  IF total_devido > 0 THEN
    SELECT budget INTO comprador_caixa FROM public.clubs WHERE id = t.clube_comprador_id FOR UPDATE;
    IF comprador_caixa < total_devido THEN
      RAISE EXCEPTION 'Clube comprador não tem caixa suficiente (necessário: %, disponível: %)', total_devido, comprador_caixa;
    END IF;
    UPDATE public.clubs SET budget = budget - total_devido WHERE id = t.clube_comprador_id;
    UPDATE public.clubs SET budget = budget + total_devido WHERE id = t.clube_vendedor_id;
  END IF;

  IF t.tipo IN ('compra', 'emprestimo') THEN
    UPDATE public.players
      SET club_id = t.clube_comprador_id,
          salario_atual = t.salario_ofertado,
          a_venda = false
      WHERE id = t.jogador_id;
  ELSIF t.tipo = 'troca' THEN
    UPDATE public.players
      SET club_id = t.clube_comprador_id,
          salario_atual = t.salario_ofertado,
          a_venda = false
      WHERE id = t.jogador_id;
    IF t.jogador_trocado_id IS NOT NULL THEN
      UPDATE public.players
        SET club_id = t.clube_vendedor_id,
            a_venda = false
        WHERE id = t.jogador_trocado_id;
    END IF;
  END IF;

  UPDATE public.transferencias SET status = 'aceita' WHERE id = _transfer_id;

  UPDATE public.transferencias
    SET status = 'recusada'
    WHERE jogador_id = t.jogador_id AND id <> _transfer_id AND status = 'pendente';

  -- Registro em transactions
  SELECT name INTO v_player_name FROM public.players WHERE id = t.jogador_id;
  SELECT name INTO v_comp_name FROM public.clubs WHERE id = t.clube_comprador_id;
  SELECT name INTO v_vend_name FROM public.clubs WHERE id = t.clube_vendedor_id;
  SELECT COALESCE((value->>'ano')::int, 2026) INTO v_temp FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  IF total_devido > 0 THEN
    INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao, related_player_id, related_club_id, temporada, metadata)
    VALUES (
      t.clube_comprador_id, 'saida', 'transferencia', total_devido,
      'Compra de ' || COALESCE(v_player_name, '?') || ' do ' || COALESCE(v_vend_name, '?'),
      t.jogador_id, t.clube_vendedor_id, v_temp,
      jsonb_build_object('tipo_op', t.tipo, 'valor', t.valor_ofertado, 'luvas', t.luvas, 'salario', t.salario_ofertado)
    );
    INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao, related_player_id, related_club_id, temporada, metadata)
    VALUES (
      t.clube_vendedor_id, 'entrada', 'transferencia', total_devido,
      'Venda de ' || COALESCE(v_player_name, '?') || ' para o ' || COALESCE(v_comp_name, '?'),
      t.jogador_id, t.clube_comprador_id, v_temp,
      jsonb_build_object('tipo_op', t.tipo, 'valor', t.valor_ofertado, 'luvas', t.luvas)
    );
  ELSE
    -- Empréstimo grátis ou troca sem dinheiro: registra evento informativo
    INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao, related_player_id, related_club_id, temporada, metadata)
    VALUES (
      t.clube_comprador_id, 'entrada', 'transferencia', 0,
      'Chegada de ' || COALESCE(v_player_name, '?') || ' (' || t.tipo || ')',
      t.jogador_id, t.clube_vendedor_id, v_temp,
      jsonb_build_object('tipo_op', t.tipo)
    );
  END IF;
END;
$function$;

-- 3. upgrade_estadio com registro
CREATE OR REPLACE FUNCTION public.upgrade_estadio(_club_id uuid, _novo_nivel integer, _nova_capacidade integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
  custos JSONB;
  cap_max INTEGER;
  custo_por_lugar NUMERIC := 500;
  custo_total NUMERIC := 0;
  custo_nivel NUMERIC := 0;
  lugares_extras INTEGER := 0;
  v_temp INTEGER;
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

  IF custo_total > 0 THEN
    SELECT COALESCE((value->>'ano')::int, 2026) INTO v_temp FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;
    INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao, temporada, metadata)
    VALUES (
      _club_id, 'saida', 'upgrade_estadio', custo_total,
      'Upgrade de estádio: nível ' || c.nivel_estadio || '→' || _novo_nivel || ', capacidade ' || c.stadium_capacity || '→' || _nova_capacidade,
      v_temp,
      jsonb_build_object('nivel_de', c.nivel_estadio, 'nivel_para', _novo_nivel, 'cap_de', c.stadium_capacity, 'cap_para', _nova_capacidade)
    );
  END IF;
END; $function$;

-- 4. pagar_multa_rescisoria com registro
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
BEGIN
  SELECT * INTO p FROM public.players WHERE id = _jogador_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;
  IF p.club_id IS NULL THEN RAISE EXCEPTION 'Jogador é agente livre, não tem multa'; END IF;
  IF p.club_id = _clube_comprador_id THEN RAISE EXCEPTION 'Clube já é o dono do jogador'; END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.clubs WHERE id = _clube_comprador_id AND owner_id = auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  multa := COALESCE(p.valor_base_calculado, 0) * 10;
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
    SET club_id = _clube_comprador_id,
        salario_atual = _novo_salario,
        contrato_ate = temp_atual + GREATEST(_anos_contrato, 1),
        a_venda = false
    WHERE id = _jogador_id;

  -- Notifica e registra
  IF v_owner_atual IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, club_id, tipo, titulo, mensagem, payload)
    VALUES (
      v_owner_atual, v_clube_atual_id, 'multa_paga',
      'Multa paga: ' || p.name,
      'O ' || v_clube_comp_nome || ' pagou a multa rescisória de ' || multa::text || ' para tirar ' || p.name || ' do seu clube.',
      jsonb_build_object('player_name', p.name, 'multa', multa, 'comprador', v_clube_comp_nome)
    );
  END IF;

  INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao, related_player_id, related_club_id, temporada, metadata)
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
