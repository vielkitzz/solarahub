
-- 1) Bloqueio de propostas por jogador
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS bloquear_propostas boolean NOT NULL DEFAULT false;

-- 2) Estender trigger fn_check_transfer_window para bloquear propostas a:
--    - jogadores com bloquear_propostas
--    - jogadores vendidos para o exterior (external_club_id IS NOT NULL)
--    - jogadores atualmente emprestados (no clube tomador)
CREATE OR REPLACE FUNCTION public.fn_check_transfer_window()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  win JSONB; v_open boolean; v_ban_c boolean; v_ban_v boolean;
  v_player RECORD; v_on_loan boolean;
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

    -- Empréstimo ativo: jogador está no clube tomador (clube_comprador_id) de um emprestimo aceito
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
$$;

-- 3) Salvar club_origin na metadata da transação de contratação estrangeira
CREATE OR REPLACE FUNCTION public.contratar_jogador_direto(
  _clube_id uuid, _jogador_id uuid, _salario numeric, _luvas numeric, _valor numeric,
  _tipo text, _user_id uuid, _anos_contrato integer DEFAULT 1, _percentual_revenda numeric DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c                RECORD;
  p                RECORD;
  fp               RECORD;
  fa               RECORD;
  temp_atual       INTEGER;
  real_player_id   UUID;
  player_name      TEXT;
  total_devido     NUMERIC;
  v_club_origin    TEXT;
BEGIN
  SELECT * INTO c FROM public.clubs WHERE id = _clube_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Clube não encontrado'; END IF;

  SELECT (value->>'ano')::int INTO temp_atual FROM public.settings WHERE key = 'temporada_atual';
  IF temp_atual IS NULL THEN temp_atual := EXTRACT(YEAR FROM now())::int; END IF;

  SELECT * INTO p FROM public.players WHERE id = _jogador_id;

  IF p.id IS NULL THEN
    SELECT * INTO fp FROM public.foreign_market_players WHERE id = _jogador_id;
    IF FOUND THEN
      v_club_origin := fp.club_origin;
      player_name := fp.name;
      INSERT INTO public.players (
        club_id, name, position, age, nationality,
        habilidade, potential_min, potential_max,
        salario_atual, contrato_ate, a_venda, attributes
      ) VALUES (
        _clube_id,
        fp.name, fp.position, fp.age, fp.nationality,
        fp.overall,
        GREATEST(45, fp.overall - 5),
        LEAST(94, fp.overall + 3),
        _salario,
        temp_atual + GREATEST(_anos_contrato, 1),
        false,
        jsonb_build_object('origem', 'estrangeiro', 'club_origin', fp.club_origin, 'league_origin', fp.league_origin)
      ) RETURNING id INTO real_player_id;

      DELETE FROM public.foreign_market_players WHERE id = _jogador_id;
    ELSE
      SELECT * INTO fa FROM public.free_agents WHERE id = _jogador_id;
      IF FOUND THEN
        player_name := fa.name;
        INSERT INTO public.players (
          club_id, name, position, age, nationality,
          habilidade, potential_min, potential_max,
          salario_atual, contrato_ate, a_venda, attributes
        ) VALUES (
          _clube_id,
          fa.name, fa.position, fa.age, fa.nationality,
          fa.overall,
          COALESCE(fa.potential_min, fa.overall),
          COALESCE(fa.potential_max, fa.overall),
          _salario,
          temp_atual + GREATEST(_anos_contrato, 1),
          false,
          jsonb_build_object('origem', 'passe_livre', 'last_club', fa.last_club)
        ) RETURNING id INTO real_player_id;

        DELETE FROM public.free_agents WHERE id = _jogador_id;
      ELSE
        RAISE EXCEPTION 'Jogador não encontrado em nenhuma tabela';
      END IF;
    END IF;
  ELSE
    real_player_id := p.id;
    player_name := p.name;

    UPDATE public.players
    SET club_id = _clube_id,
        salario_atual = _salario,
        contrato_ate = temp_atual + GREATEST(_anos_contrato, 1),
        a_venda = false
    WHERE id = real_player_id;

    UPDATE public.transferencias
    SET status = 'recusada'
    WHERE jogador_id = real_player_id AND status IN ('pendente', 'aguardando_confirmacao');
  END IF;

  total_devido := COALESCE(_valor, 0) + COALESCE(_luvas, 0);

  IF total_devido > 0 THEN
    IF c.budget < total_devido THEN
      RAISE EXCEPTION 'Caixa insuficiente. Necessário %, disponível %', total_devido, c.budget;
    END IF;
    UPDATE public.clubs SET budget = budget - total_devido WHERE id = _clube_id;

    INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao, related_player_id, temporada, metadata)
    VALUES (
      _clube_id, 'saida', 'transferencia', total_devido,
      'Contratação de ' || COALESCE(player_name, '?') || ' (' || _tipo || ')',
      real_player_id, temp_atual,
      jsonb_build_object('tipo_op', _tipo, 'valor', _valor, 'luvas', _luvas, 'salario', _salario, 'club_origin', v_club_origin)
    );
  ELSE
    INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao, related_player_id, temporada, metadata)
    VALUES (
      _clube_id, 'saida', 'transferencia', 0,
      'Contratação de ' || COALESCE(player_name, '?') || ' (' || _tipo || ' - passe livre)',
      real_player_id, temp_atual,
      jsonb_build_object('tipo_op', _tipo, 'valor', 0, 'luvas', 0, 'salario', _salario, 'club_origin', v_club_origin)
    );
  END IF;
END;
$function$;

-- 4) Segurança: empresas — remover política aberta de inserção
DROP POLICY IF EXISTS "Permitir inserção de empresas" ON public.empresas;

-- 5) Segurança: corrigir policies do bucket club-kits (qualificar storage.objects.name)
DROP POLICY IF EXISTS "club-kits owner write" ON storage.objects;
CREATE POLICY "club-kits owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-kits'
    AND (
      has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
          AND c.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "club-kits owner update" ON storage.objects;
CREATE POLICY "club-kits owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-kits' AND (
      has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
          AND c.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "club-kits owner delete" ON storage.objects;
CREATE POLICY "club-kits owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-kits' AND (
      has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
          AND c.owner_id = auth.uid()
      )
    )
  );

-- 6) Segurança: bucket 'kits' — adicionar verificação de propriedade
DROP POLICY IF EXISTS "kits owner insert" ON storage.objects;
DROP POLICY IF EXISTS "kits owner update" ON storage.objects;
DROP POLICY IF EXISTS "kits owner delete" ON storage.objects;

CREATE POLICY "kits owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kits' AND (
      has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
          AND c.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "kits owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'kits' AND (
      has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
          AND c.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "kits owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'kits' AND (
      has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
          AND c.owner_id = auth.uid()
      )
    )
  );
