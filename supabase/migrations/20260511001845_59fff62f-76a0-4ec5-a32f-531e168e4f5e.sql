
-- 1) clubs.transfer_ban
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS transfer_ban boolean NOT NULL DEFAULT false;

-- 2) economia_params: novos defaults
UPDATE public.settings
SET value = COALESCE(value,'{}'::jsonb)
  || jsonb_build_object(
       'custos_operacionais_pct', COALESCE((value->>'custos_operacionais_pct')::numeric, 0.25),
       'manutencao_estadio_por_nivel', COALESCE((value->>'manutencao_estadio_por_nivel')::numeric, 200000)
     )
WHERE key = 'economia_params';

-- 3) transfer_window setting
INSERT INTO public.settings(key,value)
VALUES ('transfer_window', '{"open": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4) preview_season_turnover (recriada com novos campos)
DROP FUNCTION IF EXISTS public.preview_season_turnover();
CREATE OR REPLACE FUNCTION public.preview_season_turnover()
 RETURNS TABLE(club_id uuid, club_name text, reputacao text,
   receita_base numeric, bilheteria numeric, contratos numeric, premiacao numeric,
   manutencao numeric, manutencao_estadio numeric, custos_operacionais numeric,
   folha numeric, delta numeric, novo_caixa numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD; econ JSONB;
  rb NUMERIC; bilh NUMERIC; manut NUMERIC; manut_est NUMERIC; flh NUMERIC; ctr NUMERIC; prem NUMERIC; oper NUMERIC;
  manut_por_nivel NUMERIC; manut_est_por_nivel NUMERIC; oper_pct NUMERIC;
  preco_medio NUMERIC; jogos INTEGER;
  temp_atual INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem ver a prévia';
  END IF;
  SELECT value INTO econ FROM public.settings WHERE key = 'economia_params' LIMIT 1;
  manut_por_nivel       := COALESCE((econ->>'manutencao_por_nivel_base')::numeric, 300000);
  manut_est_por_nivel   := COALESCE((econ->>'manutencao_estadio_por_nivel')::numeric, 200000);
  oper_pct              := COALESCE((econ->>'custos_operacionais_pct')::numeric, 0.25);
  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' ORDER BY name LOOP
    rb := public.get_tv_rights_value(c.id);
    preco_medio := (COALESCE(c.preco_ingresso_nacional, 0) + COALESCE(c.preco_ingresso_internacional, 0)) / 2.0;
    jogos := COALESCE(c.jogos_por_temporada, 38);
    bilh := COALESCE(c.stadium_capacity, 0) * 0.85 * preco_medio * jogos * (c.rate / 3.0);
    manut := c.nivel_base * manut_por_nivel;
    manut_est := c.nivel_estadio * manut_est_por_nivel * (COALESCE(c.stadium_capacity,0) / 10000.0);
    prem := public.premiacao_clube_temporada(c.id, temp_atual);
    SELECT COALESCE(SUM(salario_atual),0) INTO flh FROM public.players WHERE players.club_id = c.id;
    SELECT COALESCE(SUM(valor_anual),0) INTO ctr FROM public.contratos_clube WHERE contratos_clube.club_id = c.id AND ativo = true;
    oper := (rb + bilh + ctr) * oper_pct;

    club_id := c.id; club_name := c.name; reputacao := c.reputacao::text;
    receita_base := rb; bilheteria := bilh; contratos := ctr; premiacao := prem;
    manutencao := manut; manutencao_estadio := manut_est; custos_operacionais := oper; folha := flh;
    delta := rb + bilh + ctr + prem - manut - manut_est - oper - flh;
    novo_caixa := c.budget + delta;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- 5) process_season_turnover (atualiza fórmula + INSERTS de transactions)
CREATE OR REPLACE FUNCTION public.process_season_turnover()
 RETURNS TABLE(club_id uuid, club_name text, delta numeric, novo_caixa numeric)
 LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  c RECORD; ap RECORD; pl RECORD;
  v_tv NUMERIC; bilheteria NUMERIC; manutencao NUMERIC; manut_est NUMERIC; oper NUMERIC;
  folha NUMERIC; contratos NUMERIC; premiacao NUMERIC;
  total_delta NUMERIC; temp_atual INTEGER; nova_temp INTEGER;
  ganho_progresso NUMERIC; mult_base NUMERIC; novo_skill INTEGER;
  preco_medio NUMERIC; jogos INTEGER; econ JSONB;
  manut_por_nivel NUMERIC; manut_est_por_nivel NUMERIC; oper_pct NUMERIC;
  v_emprestimo RECORD;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar a virada de temporada';
  END IF;

  PERFORM public.expirar_propostas_externas();

  UPDATE public.transferencias SET status = 'recusada'
    WHERE status IN ('pendente','contraproposta','aguardando_confirmacao');

  SELECT value INTO econ FROM public.settings WHERE key = 'economia_params' LIMIT 1;
  manut_por_nivel     := COALESCE((econ->>'manutencao_por_nivel_base')::numeric, 300000);
  manut_est_por_nivel := COALESCE((econ->>'manutencao_estadio_por_nivel')::numeric, 200000);
  oper_pct            := COALESCE((econ->>'custos_operacionais_pct')::numeric, 0.25);

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;
  nova_temp := temp_atual + 1;

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' LOOP
    v_tv := public.get_tv_rights_value(c.id);
    preco_medio := (COALESCE(c.preco_ingresso_nacional,0) + COALESCE(c.preco_ingresso_internacional,0))/2.0;
    jogos := COALESCE(c.jogos_por_temporada,38);
    bilheteria := COALESCE(c.stadium_capacity,0) * 0.85 * preco_medio * jogos * (c.rate/3.0);
    manutencao := c.nivel_base * manut_por_nivel;
    manut_est  := c.nivel_estadio * manut_est_por_nivel * (COALESCE(c.stadium_capacity,0) / 10000.0);
    premiacao := public.premiacao_clube_temporada(c.id, temp_atual);

    SELECT COALESCE(SUM(salario_atual),0) INTO folha FROM public.players WHERE players.club_id = c.id;
    SELECT COALESCE(SUM(valor_anual),0) INTO contratos FROM public.contratos_clube
      WHERE contratos_clube.club_id = c.id AND ativo = true;

    oper := (v_tv + bilheteria + contratos) * oper_pct;
    total_delta := v_tv + bilheteria + contratos + premiacao - manutencao - manut_est - oper - folha;
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
      VALUES (c.id,'saida','manutencao',manutencao,'Manutenção da base (temp ' || temp_atual || ')',temp_atual); END IF;
    IF manut_est > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'saida','manutencao_estadio',manut_est,'Manutenção do estádio (temp ' || temp_atual || ')',temp_atual); END IF;
    IF oper > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'saida','operacional',oper,'Custos operacionais (temp ' || temp_atual || ')',temp_atual); END IF;
    IF folha > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'saida','salario',folha,'Folha salarial (temp ' || temp_atual || ')',temp_atual); END IF;

    mult_base := CASE c.nivel_base WHEN 1 THEN 0.80 WHEN 2 THEN 0.95 WHEN 3 THEN 1.10
      WHEN 4 THEN 1.20 WHEN 5 THEN 1.30 ELSE 1.0 END;

    FOR ap IN SELECT * FROM public.academy_players WHERE academy_players.club_id = c.id LOOP
      ganho_progresso := (
        CASE
          WHEN ap.age <= 17 THEN 28 + random() * 7
          WHEN ap.age <= 19 THEN 25 + random() * 7
          WHEN ap.age <= 21 THEN 20 + random() * 7
          ELSE                    10 + random() * 7
        END
      ) * mult_base;
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

  FOR v_emprestimo IN
    SELECT DISTINCT ON (t.jogador_id)
      t.jogador_id, t.clube_vendedor_id AS clube_origem_id, p.salario_atual
    FROM public.transferencias t
    JOIN public.players p ON p.id = t.jogador_id
    WHERE t.tipo = 'emprestimo' AND t.status = 'aceita'
      AND p.contrato_ate IS NOT NULL AND p.contrato_ate <= temp_atual
      AND t.clube_vendedor_id IS NOT NULL
    ORDER BY t.jogador_id, t.created_at DESC
  LOOP
    UPDATE public.players
    SET club_id = v_emprestimo.clube_origem_id, a_venda = false, contrato_ate = nova_temp + 1
    WHERE id = v_emprestimo.jogador_id;
  END LOOP;

  UPDATE public.players SET club_id = NULL, a_venda = false
    WHERE contrato_ate IS NOT NULL AND contrato_ate <= temp_atual AND club_id IS NOT NULL
      AND id NOT IN (
        SELECT DISTINCT t.jogador_id FROM public.transferencias t
        JOIN public.players p ON p.id = t.jogador_id
        WHERE t.tipo = 'emprestimo' AND t.status = 'aceita' AND t.clube_vendedor_id IS NOT NULL
      );

  -- Reset contador de insatisfação a cada temporada
  UPDATE public.players SET attributes = COALESCE(attributes,'{}'::jsonb)
    - 'propostas_recusadas' - 'unhappy_triggered_at';

  PERFORM public.processar_aposentadorias();
  PERFORM public.avisar_aposentadorias_proximas();
  UPDATE public.clubs SET posicao_ultima_temporada = NULL WHERE status = 'ativo';
  UPDATE public.settings SET value = jsonb_build_object('ano', nova_temp) WHERE key = 'temporada_atual';

  PERFORM public.gerar_propostas_externas();
  PERFORM encerrar_contratos_vencidos();
END
$function$;

-- 6) Trigger: bloqueia transferências quando janela está fechada ou clube tem transferban
CREATE OR REPLACE FUNCTION public.fn_check_transfer_window()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE win JSONB; v_open boolean; v_ban_c boolean; v_ban_v boolean;
BEGIN
  -- admin sempre pode (para criar propostas administrativas)
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_check_transfer_window ON public.transferencias;
CREATE TRIGGER tg_check_transfer_window BEFORE INSERT ON public.transferencias
FOR EACH ROW EXECUTE FUNCTION public.fn_check_transfer_window();

-- 7) Trigger: insatisfação após múltiplas recusas
CREATE OR REPLACE FUNCTION public.fn_player_unhappy_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_player RECORD; v_owner UUID; v_club RECORD; v_count INT; v_action TEXT;
BEGIN
  IF NEW.status <> 'recusada' OR (TG_OP = 'UPDATE' AND OLD.status = 'recusada') THEN
    RETURN NEW;
  END IF;
  -- só faz sentido se jogador é de um clube real
  SELECT * INTO v_player FROM public.players WHERE id = NEW.jogador_id;
  IF v_player.id IS NULL OR v_player.club_id IS NULL THEN RETURN NEW; END IF;

  -- incrementa contador
  UPDATE public.players
  SET attributes = COALESCE(attributes,'{}'::jsonb)
    || jsonb_build_object('propostas_recusadas',
       (COALESCE((attributes->>'propostas_recusadas')::int,0) + 1))
  WHERE id = v_player.id
  RETURNING (attributes->>'propostas_recusadas')::int INTO v_count;

  IF v_count IS NULL OR v_count < 5 THEN RETURN NEW; END IF;
  -- Já disparou nesta temporada?
  IF (v_player.attributes ? 'unhappy_triggered_at') THEN RETURN NEW; END IF;

  v_action := CASE WHEN random() < 0.5 THEN 'sair' ELSE 'nao_renovar' END;

  SELECT * INTO v_club FROM public.clubs WHERE id = v_player.club_id;
  v_owner := v_club.owner_id;

  IF v_action = 'sair' THEN
    UPDATE public.players SET a_venda = true,
      attributes = COALESCE(attributes,'{}'::jsonb)
        || jsonb_build_object('unhappy_triggered_at', now()::text, 'unhappy_action','sair')
    WHERE id = v_player.id;
  ELSE
    UPDATE public.players SET interesse_renovacao = false,
      attributes = COALESCE(attributes,'{}'::jsonb)
        || jsonb_build_object('unhappy_triggered_at', now()::text, 'unhappy_action','nao_renovar')
    WHERE id = v_player.id;
  END IF;

  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, club_id, tipo, titulo, mensagem, payload)
    VALUES (v_owner, v_club.id, 'player_unhappy',
      'Jogador insatisfeito: ' || v_player.name,
      CASE WHEN v_action='sair'
           THEN v_player.name || ' rejeitou várias propostas e agora deseja ser vendido.'
           ELSE v_player.name || ' está descontente e não pretende renovar o contrato.'
      END,
      jsonb_build_object('player_id', v_player.id, 'action', v_action, 'count', v_count));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_player_unhappy_after_reject ON public.transferencias;
CREATE TRIGGER tg_player_unhappy_after_reject AFTER INSERT OR UPDATE OF status ON public.transferencias
FOR EACH ROW EXECUTE FUNCTION public.fn_player_unhappy_check();

-- mesma lógica para external_proposals
CREATE OR REPLACE FUNCTION public.fn_player_unhappy_external()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_player RECORD; v_owner UUID; v_club RECORD; v_count INT; v_action TEXT;
BEGIN
  IF NEW.status <> 'recusada' OR (TG_OP='UPDATE' AND OLD.status='recusada') THEN RETURN NEW; END IF;
  SELECT * INTO v_player FROM public.players WHERE id = NEW.player_id;
  IF v_player.id IS NULL OR v_player.club_id IS NULL THEN RETURN NEW; END IF;

  -- contador já é incrementado em responder_proposta_externa para ação manual
  v_count := COALESCE((v_player.attributes->>'propostas_recusadas')::int,0);
  IF v_count < 5 OR (v_player.attributes ? 'unhappy_triggered_at') THEN RETURN NEW; END IF;

  v_action := CASE WHEN random() < 0.5 THEN 'sair' ELSE 'nao_renovar' END;
  SELECT * INTO v_club FROM public.clubs WHERE id = v_player.club_id;
  v_owner := v_club.owner_id;

  IF v_action = 'sair' THEN
    UPDATE public.players SET a_venda = true,
      attributes = COALESCE(attributes,'{}'::jsonb)
        || jsonb_build_object('unhappy_triggered_at', now()::text, 'unhappy_action','sair')
    WHERE id = v_player.id;
  ELSE
    UPDATE public.players SET interesse_renovacao = false,
      attributes = COALESCE(attributes,'{}'::jsonb)
        || jsonb_build_object('unhappy_triggered_at', now()::text, 'unhappy_action','nao_renovar')
    WHERE id = v_player.id;
  END IF;

  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, club_id, tipo, titulo, mensagem, payload)
    VALUES (v_owner, v_club.id, 'player_unhappy',
      'Jogador insatisfeito: ' || v_player.name,
      CASE WHEN v_action='sair'
           THEN v_player.name || ' rejeitou várias propostas e agora deseja ser vendido.'
           ELSE v_player.name || ' está descontente e não pretende renovar o contrato.'
      END,
      jsonb_build_object('player_id', v_player.id, 'action', v_action, 'count', v_count));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_player_unhappy_external ON public.external_proposals;
CREATE TRIGGER tg_player_unhappy_external AFTER UPDATE OF status ON public.external_proposals
FOR EACH ROW EXECUTE FUNCTION public.fn_player_unhappy_external();

-- 8) get_transfer_stats
CREATE OR REPLACE FUNCTION public.get_transfer_stats(_club_id uuid)
RETURNS TABLE(total_compras int, total_vendas int, total_estrangeiros int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN tipo='saida'   AND categoria='transferencia'         THEN 1 ELSE 0 END),0)::int,
    COALESCE(SUM(CASE WHEN tipo='entrada' AND categoria='transferencia'         THEN 1 ELSE 0 END),0)::int,
    COALESCE(SUM(CASE WHEN categoria='transferencia_externa'                    THEN 1 ELSE 0 END),0)::int
  FROM public.transactions
  WHERE club_id = _club_id;
$$;
