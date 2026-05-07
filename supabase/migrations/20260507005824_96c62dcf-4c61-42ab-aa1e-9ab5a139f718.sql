
-- 1) Enum: novos status
ALTER TYPE transfer_status ADD VALUE IF NOT EXISTS 'cancelada';
ALTER TYPE transfer_status ADD VALUE IF NOT EXISTS 'aguardando_confirmacao';

-- 2) Trigger: limites de elenco
CREATE OR REPLACE FUNCTION public.enforce_squad_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  total_elenco INT;
  total_estrangeiros INT;
BEGIN
  IF NEW.club_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.club_id IS NOT DISTINCT FROM OLD.club_id THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO total_elenco FROM public.players
    WHERE club_id = NEW.club_id AND id <> NEW.id;
  IF total_elenco + 1 > 35 THEN
    RAISE EXCEPTION 'Limite de 35 jogadores no elenco principal atingido para este clube';
  END IF;

  IF COALESCE(NEW.nationality, '') <> 'Solara' THEN
    SELECT COUNT(*) INTO total_estrangeiros FROM public.players
      WHERE club_id = NEW.club_id AND id <> NEW.id
        AND COALESCE(nationality,'') <> 'Solara';
    IF total_estrangeiros + 1 > 10 THEN
      RAISE EXCEPTION 'Limite de 10 jogadores estrangeiros no elenco atingido para este clube';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_squad_limits ON public.players;
CREATE TRIGGER trg_enforce_squad_limits
  BEFORE INSERT OR UPDATE OF club_id ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.enforce_squad_limits();

CREATE OR REPLACE FUNCTION public.enforce_academy_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE total_base INT;
BEGIN
  IF NEW.club_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.club_id IS NOT DISTINCT FROM OLD.club_id THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO total_base FROM public.academy_players
    WHERE club_id = NEW.club_id AND id <> NEW.id;
  IF total_base + 1 > 20 THEN
    RAISE EXCEPTION 'Limite de 20 jogadores na base atingido para este clube';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_academy_limit ON public.academy_players;
CREATE TRIGGER trg_enforce_academy_limit
  BEFORE INSERT OR UPDATE OF club_id ON public.academy_players
  FOR EACH ROW EXECUTE FUNCTION public.enforce_academy_limit();

-- 3) Refator: aceitar proposta agora marca aguardando_confirmacao (não move jogador)
CREATE OR REPLACE FUNCTION public.accept_transfer(_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t RECORD;
  is_contra BOOLEAN;
  v_owner UUID;
  v_player_name TEXT;
  v_other_club_name TEXT;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF t.status <> 'pendente' THEN RAISE EXCEPTION 'Proposta já processada'; END IF;

  is_contra := t.proposta_pai_id IS NOT NULL;

  -- Quem aceita: a contraparte de quem enviou. created_by enviou; o outro lado aceita.
  IF is_contra THEN
    -- contraproposta: aceita quem NÃO criou
    IF NOT (has_role(auth.uid(), 'admin'::app_role)
      OR (t.created_by IS NOT NULL AND auth.uid() <> t.created_by AND
          (EXISTS (SELECT 1 FROM clubs WHERE id = t.clube_comprador_id AND owner_id = auth.uid())
           OR EXISTS (SELECT 1 FROM clubs WHERE id = t.clube_vendedor_id AND owner_id = auth.uid()))))
    THEN RAISE EXCEPTION 'Sem permissão para aceitar essa contraproposta'; END IF;
  ELSE
    IF NOT (has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM clubs WHERE id = t.clube_vendedor_id AND owner_id = auth.uid()))
    THEN RAISE EXCEPTION 'Sem permissão para aceitar essa proposta'; END IF;
  END IF;

  UPDATE public.transferencias SET status = 'aguardando_confirmacao' WHERE id = _transfer_id;

  -- Notifica o comprador para confirmar
  SELECT owner_id INTO v_owner FROM public.clubs WHERE id = t.clube_comprador_id;
  SELECT name INTO v_player_name FROM public.players WHERE id = t.jogador_id;
  SELECT name INTO v_other_club_name FROM public.clubs WHERE id = t.clube_vendedor_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, club_id, tipo, titulo, mensagem, payload)
    VALUES (v_owner, t.clube_comprador_id, 'transferencia_aguardando_confirmacao',
      'Confirmar contratação: ' || COALESCE(v_player_name,'?'),
      'Sua proposta por ' || COALESCE(v_player_name,'?') || ' foi aceita pelo ' || COALESCE(v_other_club_name,'?') || '. Confirme para concluir.',
      jsonb_build_object('transfer_id', _transfer_id, 'player_id', t.jogador_id));
  END IF;
END $$;

-- 4) Confirmar contratação (executa de fato a transferência)
CREATE OR REPLACE FUNCTION public.confirmar_contratacao(_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t RECORD;
  comprador_caixa NUMERIC;
  total_devido NUMERIC;
  v_player_name TEXT;
  v_comp_name TEXT;
  v_vend_name TEXT;
  v_temp INTEGER;
  v_owner_v UUID;
  v_owner_c UUID;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF t.status <> 'aguardando_confirmacao' THEN RAISE EXCEPTION 'Proposta não está aguardando confirmação'; END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM clubs WHERE id = t.clube_comprador_id AND owner_id = auth.uid()))
  THEN RAISE EXCEPTION 'Apenas o clube comprador pode confirmar a contratação'; END IF;

  total_devido := COALESCE(t.valor_ofertado,0) + COALESCE(t.luvas,0);

  IF total_devido > 0 THEN
    SELECT budget INTO comprador_caixa FROM public.clubs WHERE id = t.clube_comprador_id FOR UPDATE;
    IF comprador_caixa < total_devido THEN
      RAISE EXCEPTION 'Caixa insuficiente para confirmar (necessário %, disponível %)', total_devido, comprador_caixa;
    END IF;
    UPDATE public.clubs SET budget = budget - total_devido WHERE id = t.clube_comprador_id;
    UPDATE public.clubs SET budget = budget + total_devido WHERE id = t.clube_vendedor_id;
  END IF;

  IF t.tipo IN ('compra','emprestimo') THEN
    UPDATE public.players SET club_id = t.clube_comprador_id, salario_atual = t.salario_ofertado, a_venda = false
      WHERE id = t.jogador_id;
  ELSIF t.tipo = 'troca' THEN
    UPDATE public.players SET club_id = t.clube_comprador_id, salario_atual = t.salario_ofertado, a_venda = false
      WHERE id = t.jogador_id;
    IF t.jogador_trocado_id IS NOT NULL THEN
      UPDATE public.players SET club_id = t.clube_vendedor_id, a_venda = false WHERE id = t.jogador_trocado_id;
    END IF;
  END IF;

  UPDATE public.transferencias SET status = 'aceita' WHERE id = _transfer_id;
  UPDATE public.transferencias SET status = 'recusada'
    WHERE jogador_id = t.jogador_id AND id <> _transfer_id AND status IN ('pendente','aguardando_confirmacao');

  SELECT name INTO v_player_name FROM public.players WHERE id = t.jogador_id;
  SELECT name INTO v_comp_name FROM public.clubs WHERE id = t.clube_comprador_id;
  SELECT name INTO v_vend_name FROM public.clubs WHERE id = t.clube_vendedor_id;
  SELECT COALESCE((value->>'ano')::int, 2026) INTO v_temp FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  IF total_devido > 0 THEN
    INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,related_player_id,related_club_id,temporada,metadata)
    VALUES
    (t.clube_comprador_id,'saida','transferencia',total_devido,
      'Compra de ' || COALESCE(v_player_name,'?') || ' do ' || COALESCE(v_vend_name,'?'),
      t.jogador_id, t.clube_vendedor_id, v_temp,
      jsonb_build_object('tipo_op',t.tipo,'valor',t.valor_ofertado,'luvas',t.luvas,'salario',t.salario_ofertado)),
    (t.clube_vendedor_id,'entrada','transferencia',total_devido,
      'Venda de ' || COALESCE(v_player_name,'?') || ' para o ' || COALESCE(v_comp_name,'?'),
      t.jogador_id, t.clube_comprador_id, v_temp,
      jsonb_build_object('tipo_op',t.tipo,'valor',t.valor_ofertado,'luvas',t.luvas));
  ELSE
    INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,related_player_id,related_club_id,temporada,metadata)
    VALUES (t.clube_comprador_id,'entrada','transferencia',0,
      'Chegada de ' || COALESCE(v_player_name,'?') || ' (' || t.tipo || ')',
      t.jogador_id, t.clube_vendedor_id, v_temp, jsonb_build_object('tipo_op',t.tipo));
  END IF;

  -- Notifica vendedor e comprador
  SELECT owner_id INTO v_owner_v FROM public.clubs WHERE id = t.clube_vendedor_id;
  SELECT owner_id INTO v_owner_c FROM public.clubs WHERE id = t.clube_comprador_id;
  IF v_owner_v IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,club_id,tipo,titulo,mensagem,payload)
    VALUES (v_owner_v, t.clube_vendedor_id,
      CASE WHEN t.tipo='emprestimo' THEN 'player_loaned_out' ELSE 'player_sold' END,
      CASE WHEN t.tipo='emprestimo' THEN 'Empréstimo concretizado: ' ELSE 'Jogador vendido: ' END || COALESCE(v_player_name,'?'),
      COALESCE(v_player_name,'?') || ' saiu para o ' || COALESCE(v_comp_name,'?') || '.',
      jsonb_build_object('transfer_id',_transfer_id,'player_id',t.jogador_id,'valor',total_devido));
  END IF;
  IF v_owner_c IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,club_id,tipo,titulo,mensagem,payload)
    VALUES (v_owner_c, t.clube_comprador_id,
      CASE WHEN t.tipo='emprestimo' THEN 'player_loaned_in' ELSE 'player_signed' END,
      CASE WHEN t.tipo='emprestimo' THEN 'Empréstimo concretizado: ' ELSE 'Jogador contratado: ' END || COALESCE(v_player_name,'?'),
      COALESCE(v_player_name,'?') || ' chegou ao clube vindo do ' || COALESCE(v_vend_name,'?') || '.',
      jsonb_build_object('transfer_id',_transfer_id,'player_id',t.jogador_id,'valor',total_devido));
  END IF;
END $$;

-- 5) Cancelar contratação (comprador cancela após aceite do vendedor)
CREATE OR REPLACE FUNCTION public.cancelar_contratacao(_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE t RECORD; v_owner UUID; v_player TEXT; v_comp TEXT;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF t.status <> 'aguardando_confirmacao' THEN RAISE EXCEPTION 'Proposta não está aguardando confirmação'; END IF;
  IF NOT (has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM clubs WHERE id = t.clube_comprador_id AND owner_id = auth.uid()))
  THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  UPDATE public.transferencias SET status = 'cancelada' WHERE id = _transfer_id;

  SELECT owner_id INTO v_owner FROM public.clubs WHERE id = t.clube_vendedor_id;
  SELECT name INTO v_player FROM public.players WHERE id = t.jogador_id;
  SELECT name INTO v_comp FROM public.clubs WHERE id = t.clube_comprador_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,club_id,tipo,titulo,mensagem,payload)
    VALUES (v_owner, t.clube_vendedor_id,'transferencia_cancelada',
      'Contratação cancelada',
      COALESCE(v_comp,'?') || ' desistiu da contratação de ' || COALESCE(v_player,'?') || '.',
      jsonb_build_object('transfer_id',_transfer_id));
  END IF;
END $$;

-- 6) Remover proposta (criador cancela enquanto pendente)
CREATE OR REPLACE FUNCTION public.remover_proposta(_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE t RECORD;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF t.status <> 'pendente' THEN RAISE EXCEPTION 'Apenas propostas pendentes podem ser removidas'; END IF;
  IF NOT (has_role(auth.uid(),'admin'::app_role)
    OR (t.created_by IS NOT NULL AND auth.uid() = t.created_by)
    OR EXISTS (SELECT 1 FROM clubs WHERE id = t.clube_comprador_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM clubs WHERE id = t.clube_vendedor_id AND owner_id = auth.uid()))
  THEN RAISE EXCEPTION 'Sem permissão para remover esta proposta'; END IF;
  UPDATE public.transferencias SET status = 'cancelada' WHERE id = _transfer_id;
END $$;

-- 7) Contraproposta sem limite e por qualquer lado
CREATE OR REPLACE FUNCTION public.criar_contraproposta(_proposta_id uuid, _valor numeric, _salario numeric, _luvas numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE orig RECORD; nova_id UUID;
BEGIN
  SELECT * INTO orig FROM public.transferencias WHERE id = _proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta original não encontrada'; END IF;
  IF orig.status <> 'pendente' THEN RAISE EXCEPTION 'Apenas propostas pendentes podem ter contraproposta'; END IF;

  -- Permite contraproposta de qualquer um dos dois lados (exceto quem criou a última)
  IF NOT (has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM clubs WHERE id = orig.clube_vendedor_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM clubs WHERE id = orig.clube_comprador_id AND owner_id = auth.uid()))
  THEN RAISE EXCEPTION 'Sem permissão para contra-propor'; END IF;

  UPDATE public.transferencias SET status = 'contraproposta' WHERE id = _proposta_id;

  INSERT INTO public.transferencias(jogador_id,clube_comprador_id,clube_vendedor_id,
    valor_ofertado,salario_ofertado,luvas,tipo,jogador_trocado_id,duracao_emprestimo,
    created_by,proposta_pai_id,status)
  VALUES (orig.jogador_id, orig.clube_comprador_id, orig.clube_vendedor_id,
    _valor,_salario,_luvas,orig.tipo,orig.jogador_trocado_id,orig.duracao_emprestimo,
    auth.uid(), _proposta_id, 'pendente')
  RETURNING id INTO nova_id;
  RETURN nova_id;
END $$;

-- 8) Aviso de aposentadoria iminente: roda na virada — avisa quem tem 33+ (ainda joga próxima)
CREATE OR REPLACE FUNCTION public.avisar_aposentadorias_proximas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE p RECORD; v_owner UUID;
BEGIN
  FOR p IN
    SELECT pl.id, pl.name, pl.age, pl.club_id, c.owner_id
    FROM public.players pl JOIN public.clubs c ON c.id = pl.club_id
    WHERE pl.age >= 33 AND c.owner_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications(user_id,club_id,tipo,titulo,mensagem,payload)
    VALUES (p.owner_id, p.club_id, 'player_retiring_soon',
      'Aposentadoria à vista: ' || p.name,
      p.name || ' (' || p.age || ' anos) pode pendurar as chuteiras na próxima temporada.',
      jsonb_build_object('player_id',p.id,'player_name',p.name,'age',p.age));
  END LOOP;
END $$;

-- 9) Inclui aviso de aposentadoria na virada
CREATE OR REPLACE FUNCTION public.process_season_turnover()
RETURNS TABLE(club_id uuid, club_name text, delta numeric, novo_caixa numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c RECORD; ap RECORD; pl RECORD;
  v_tv NUMERIC; bilheteria NUMERIC; manutencao NUMERIC;
  folha NUMERIC; contratos NUMERIC; premiacao NUMERIC;
  total_delta NUMERIC; temp_atual INTEGER; nova_temp INTEGER;
  ganho_progresso NUMERIC; mult_base NUMERIC; novo_skill INTEGER;
  preco_medio NUMERIC; jogos INTEGER; econ JSONB; manut_por_nivel NUMERIC;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar a virada de temporada';
  END IF;

  PERFORM public.expirar_propostas_externas();

  -- Expira propostas internas pendentes/aguardando
  UPDATE public.transferencias SET status = 'recusada'
    WHERE status IN ('pendente','contraproposta','aguardando_confirmacao');

  SELECT value INTO econ FROM public.settings WHERE key = 'economia_params' LIMIT 1;
  manut_por_nivel := COALESCE((econ->>'manutencao_por_nivel_base')::numeric, 300000);

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;
  nova_temp := temp_atual + 1;

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' LOOP
    v_tv := public.get_tv_rights_value(c.id);
    preco_medio := (COALESCE(c.preco_ingresso_nacional,0) + COALESCE(c.preco_ingresso_internacional,0))/2.0;
    jogos := COALESCE(c.jogos_por_temporada,38);
    bilheteria := COALESCE(c.stadium_capacity,0) * 0.85 * preco_medio * jogos * (c.rate/3.0);
    manutencao := c.nivel_base * manut_por_nivel;
    premiacao := public.premiacao_clube_temporada(c.id, temp_atual);

    SELECT COALESCE(SUM(salario_atual),0) INTO folha FROM public.players WHERE players.club_id = c.id;
    SELECT COALESCE(SUM(valor_anual),0) INTO contratos FROM public.contratos_clube
      WHERE contratos_clube.club_id = c.id AND ativo = true;

    total_delta := v_tv + bilheteria + contratos + premiacao - manutencao - folha;
    UPDATE public.clubs SET budget = budget + total_delta WHERE id = c.id;

    IF v_tv > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'entrada','tv',v_tv,'Direitos de TV (temp ' || temp_atual || ')',temp_atual); END IF;
    IF bilheteria > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'entrada','bilheteria',bilheteria,'Bilheteria anual (temp ' || temp_atual || ')',temp_atual); END IF;
    IF contratos > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'entrada','patrocinio',contratos,'Patrocínios anuais (temp ' || temp_atual || ')',temp_atual); END IF;
    IF premiacao > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'entrada','premiacao',premiacao,'Premiações de torneios (temp ' || temp_atual || ')',temp_atual); END IF;
    IF manutencao > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'saida','manutencao',manutencao,'Manutenção de base/estádio (temp ' || temp_atual || ')',temp_atual); END IF;
    IF folha > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'saida','salario',folha,'Folha salarial (temp ' || temp_atual || ')',temp_atual); END IF;

    mult_base := CASE c.nivel_base WHEN 1 THEN 0.80 WHEN 2 THEN 0.95 WHEN 3 THEN 1.10
      WHEN 4 THEN 1.20 WHEN 5 THEN 1.30 ELSE 1.0 END;

    FOR ap IN SELECT * FROM public.academy_players WHERE academy_players.club_id = c.id LOOP
      ganho_progresso := CASE WHEN ap.age <= 18 THEN 15 + random()*5
        WHEN ap.age <= 21 THEN 10 + random()*5 ELSE 5 + random()*5 END * mult_base;
      IF ap.development_progress < 100 THEN
        novo_skill := LEAST(ap.potential_max,
          ap.skill + ROUND(((ap.potential_max - ap.skill)*(ganho_progresso/100.0)))::INTEGER);
        UPDATE public.academy_players
        SET development_progress = LEAST(100, ap.development_progress + ganho_progresso),
            skill = novo_skill, seasons_in_academy = ap.seasons_in_academy + 1, age = ap.age + 1
        WHERE id = ap.id;
      END IF;
    END LOOP;

    FOR pl IN SELECT * FROM public.players WHERE players.club_id = c.id LOOP
      IF pl.age IS NOT NULL AND pl.habilidade IS NOT NULL AND pl.potential_max IS NOT NULL THEN
        IF pl.age >= 31 THEN
          novo_skill := GREATEST(45, pl.habilidade - (1 + floor(random()*3))::INTEGER);
        ELSIF pl.age <= 27 AND pl.habilidade < pl.potential_max THEN
          novo_skill := LEAST(pl.potential_max, pl.habilidade + (1 + floor(random()*3))::INTEGER);
        ELSE
          novo_skill := pl.habilidade;
        END IF;
        UPDATE public.players SET habilidade = novo_skill, habilidade_anterior = pl.habilidade, age = pl.age + 1
        WHERE id = pl.id;
      END IF;
    END LOOP;

    club_id := c.id; club_name := c.name; delta := total_delta; novo_caixa := c.budget + total_delta;
    RETURN NEXT;
  END LOOP;

  UPDATE public.clubs SET academy_scouting_count = 0 WHERE status = 'ativo';
  UPDATE public.players SET club_id = NULL, a_venda = false
    WHERE contrato_ate IS NOT NULL AND contrato_ate <= temp_atual;

  PERFORM public.processar_aposentadorias();
  PERFORM public.avisar_aposentadorias_proximas();
  UPDATE public.clubs SET posicao_ultima_temporada = NULL WHERE status = 'ativo';
  UPDATE public.settings SET value = jsonb_build_object('ano', nova_temp) WHERE key = 'temporada_atual';

  PERFORM public.gerar_propostas_externas();
END $$;
