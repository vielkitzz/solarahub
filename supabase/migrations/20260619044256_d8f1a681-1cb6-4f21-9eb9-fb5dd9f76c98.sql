
-- Fix 1: Loan return on next season turn
CREATE OR REPLACE FUNCTION public.process_season_turnover()
 RETURNS TABLE(club_id uuid, club_name text, delta numeric, novo_caixa numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD; ap RECORD; pl RECORD;
  v_tv NUMERIC; bilheteria NUMERIC; manutencao NUMERIC; manut_est NUMERIC; oper NUMERIC;
  folha NUMERIC; contratos NUMERIC; premiacao NUMERIC;
  total_delta NUMERIC; temp_atual INTEGER; nova_temp INTEGER;
  ganho_progresso NUMERIC; mult_base NUMERIC; novo_skill INTEGER; novo_progress NUMERIC;
  preco_medio NUMERIC; jogos INTEGER; econ JSONB;
  manut_por_nivel NUMERIC; manut_est_por_nivel NUMERIC; oper_pct NUMERIC;
  v_emprestimo RECORD;
  v_loan RECORD;
  v_parcela NUMERIC;
  v_finalizou BOOLEAN;
  v_dev_type TEXT;
  v_flop_chance NUMERIC;
  v_flop_max_reducao INT;
  v_flop_idade_gatilho INT;
  v_reducao INT;
  v_evolucao_mult NUMERIC;
  v_pot_max_atual INT;
  v_club_rate NUMERIC;
  v_skill_cap INTEGER;
  v_teto_efetivo INTEGER;
  v_tr RECORD;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar a virada de temporada';
  END IF;

  PERFORM set_config('app.bypass_squad_limits', 'on', true);

  PERFORM public.expirar_propostas_externas();
  UPDATE public.transferencias SET status = 'recusada'
    WHERE status IN ('pendente','contraproposta','aguardando_confirmacao','aguardando_ia');

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

    FOR v_loan IN SELECT * FROM public.loans WHERE loans.club_id = c.id AND status = 'active' LOOP
      v_parcela := v_loan.valor_parcela;
      v_finalizou := (v_loan.installments_paid + 1) >= v_loan.installments_total;
      total_delta := total_delta - v_parcela;
      UPDATE public.loans
        SET installments_paid = installments_paid + 1,
            status = CASE WHEN v_finalizou THEN 'paid' ELSE 'active' END
        WHERE id = v_loan.id;
      INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada,metadata)
      VALUES (c.id,'saida','emprestimo',v_parcela,
        'Parcela de empréstimo bancário (' || (v_loan.installments_paid+1) || '/' || v_loan.installments_total || ')',
        temp_atual, jsonb_build_object('loan_id',v_loan.id));
    END LOOP;

    UPDATE public.clubs SET budget = budget + total_delta WHERE id = c.id;

    IF v_tv > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'entrada','tv',v_tv,'Direitos de TV (temp '||temp_atual||')',temp_atual); END IF;
    IF bilheteria > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'entrada','bilheteria',bilheteria,'Bilheteria anual (temp '||temp_atual||')',temp_atual); END IF;
    IF contratos > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'entrada','patrocinio',contratos,'Patrocínios anuais (temp '||temp_atual||')',temp_atual); END IF;
    IF premiacao > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'entrada','premiacao',premiacao,'Premiações de torneios (temp '||temp_atual||')',temp_atual); END IF;
    IF manutencao > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'saida','manutencao',manutencao,'Manutenção da base (temp '||temp_atual||')',temp_atual); END IF;
    IF manut_est > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'saida','manutencao_estadio',manut_est,'Manutenção do estádio (temp '||temp_atual||')',temp_atual); END IF;
    IF oper > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'saida','operacional',oper,'Custos operacionais (temp '||temp_atual||')',temp_atual); END IF;
    IF folha > 0 THEN INSERT INTO public.transactions(club_id,tipo,categoria,valor,descricao,temporada)
      VALUES (c.id,'saida','salario',folha,'Folha salarial (temp '||temp_atual||')',temp_atual); END IF;

    mult_base := CASE c.nivel_base WHEN 1 THEN 0.80 WHEN 2 THEN 0.95 WHEN 3 THEN 1.10
      WHEN 4 THEN 1.20 WHEN 5 THEN 1.30 ELSE 1.0 END;

    v_club_rate := COALESCE(c.rate, 2.80);
    v_skill_cap := ROUND(v_club_rate * 7 + 42)::INTEGER + 5;

    FOR ap IN SELECT * FROM public.academy_players WHERE academy_players.club_id = c.id LOOP
      IF ap.development_progress >= 100 THEN
        UPDATE public.academy_players
          SET seasons_in_academy = ap.seasons_in_academy + 1, age = ap.age + 1
          WHERE id = ap.id;
      ELSE
        v_teto_efetivo := LEAST(ap.potential_max, v_skill_cap);
        ganho_progresso := (
          CASE
            WHEN ap.age <= 17 THEN 28 + random()*7
            WHEN ap.age <= 19 THEN 25 + random()*7
            WHEN ap.age <= 21 THEN 20 + random()*7
            ELSE                    10 + random()*7
          END
        ) * mult_base;

        novo_skill := LEAST(
          v_teto_efetivo,
          ap.skill + ROUND(((v_teto_efetivo - ap.skill) * (ganho_progresso / 100.0)))::INTEGER
        );

        IF novo_skill >= ap.potential_max THEN
          novo_progress := 100;
        ELSE
          novo_progress := LEAST(100, ap.development_progress + ganho_progresso);
        END IF;

        UPDATE public.academy_players
          SET skill = novo_skill,
              development_progress = novo_progress,
              seasons_in_academy = ap.seasons_in_academy + 1,
              age = ap.age + 1
          WHERE id = ap.id;
      END IF;
    END LOOP;

    FOR pl IN SELECT * FROM public.players WHERE players.club_id = c.id LOOP
      IF pl.age IS NULL OR pl.habilidade IS NULL OR pl.potential_max IS NULL THEN CONTINUE; END IF;

      v_dev_type := COALESCE(pl.attributes->>'dev_type', 'normal');
      v_pot_max_atual := pl.potential_max;

      CASE v_dev_type
        WHEN 'precoce' THEN
          v_flop_chance        := 0.20;
          v_flop_max_reducao   := 3;
          v_flop_idade_gatilho := 22;
          v_evolucao_mult      := CASE WHEN pl.age <= 22 THEN 1.4 WHEN pl.age <= 25 THEN 0.8 ELSE 0.5 END;
        WHEN 'tardio' THEN
          v_flop_chance        := 0.05;
          v_flop_max_reducao   := 1;
          v_flop_idade_gatilho := 28;
          v_evolucao_mult      := CASE WHEN pl.age <= 22 THEN 0.6 WHEN pl.age <= 28 THEN 1.3 ELSE 0.9 END;
        WHEN 'flop' THEN
          v_flop_chance        := 0.35;
          v_flop_max_reducao   := 4;
          v_flop_idade_gatilho := 20;
          v_evolucao_mult      := CASE WHEN pl.age <= 20 THEN 1.1 ELSE 0.7 END;
        ELSE
          v_flop_chance        := 0.10;
          v_flop_max_reducao   := 2;
          v_flop_idade_gatilho := 25;
          v_evolucao_mult      := 1.0;
      END CASE;

      IF pl.age >= v_flop_idade_gatilho
         AND v_pot_max_atual > pl.habilidade
         AND random() < v_flop_chance THEN
        v_reducao := 1 + floor(random() * v_flop_max_reducao)::INTEGER;
        v_pot_max_atual := GREATEST(pl.habilidade, v_pot_max_atual - v_reducao);
        UPDATE public.players
          SET potential_max = v_pot_max_atual,
              potential_min = GREATEST(pl.habilidade, LEAST(pl.potential_min, v_pot_max_atual))
          WHERE id = pl.id;
      END IF;

      IF pl.age >= 33 THEN
        novo_skill := GREATEST(45, pl.habilidade - CASE
          WHEN pl.age <= 34 THEN floor(random()*2)::INTEGER
          ELSE (1 + floor(random()*3))::INTEGER
        END);
      ELSIF pl.age >= 31 THEN
        novo_skill := GREATEST(45, pl.habilidade - floor(random()*2)::INTEGER);
      ELSIF pl.habilidade < v_pot_max_atual THEN
        novo_skill := LEAST(v_pot_max_atual,
          pl.habilidade + GREATEST(0, ROUND((1 + floor(random()*3)) * v_evolucao_mult)::INTEGER));
      ELSE
        novo_skill := pl.habilidade;
      END IF;

      UPDATE public.players
        SET habilidade = novo_skill, habilidade_anterior = pl.habilidade, age = pl.age + 1
        WHERE id = pl.id;
    END LOOP;

    FOR v_tr IN SELECT * FROM public.player_trainings
                 WHERE player_trainings.club_id = c.id AND active = true LOOP
      IF (v_tr.seasons_completed + 1) >= v_tr.seasons_total THEN
        UPDATE public.players
          SET secondary_position = v_tr.target_position
          WHERE id = v_tr.player_id;
        UPDATE public.player_trainings
          SET seasons_completed = v_tr.seasons_total, active = false
          WHERE id = v_tr.id;
        INSERT INTO public.notifications(user_id, club_id, tipo, titulo, mensagem, payload)
        SELECT cl.owner_id, c.id, 'treino_concluido',
               'Treino concluído',
               'O treinamento de adaptação para ' || v_tr.target_position || ' foi concluído.',
               jsonb_build_object('player_id', v_tr.player_id, 'target_position', v_tr.target_position)
        FROM public.clubs cl WHERE cl.id = c.id AND cl.owner_id IS NOT NULL;
      ELSE
        UPDATE public.player_trainings
          SET seasons_completed = v_tr.seasons_completed + 1
          WHERE id = v_tr.id;
      END IF;
    END LOOP;

    club_id := c.id; club_name := c.name; delta := total_delta; novo_caixa := c.budget + total_delta;
    RETURN NEXT;
  END LOOP;

  UPDATE public.clubs SET academy_scouting_count = 0 WHERE status = 'ativo';

  -- Devolução de empréstimos cujo prazo terminou (usa nova_temp para corretamente devolver após N temporadas)
  FOR v_emprestimo IN
    SELECT DISTINCT ON (t.jogador_id) t.id AS transferencia_id, t.jogador_id, t.clube_vendedor_id AS clube_origem_id
    FROM public.transferencias t
    JOIN public.players p ON p.id = t.jogador_id
    WHERE t.tipo = 'emprestimo' AND t.status = 'aceita'
      AND p.contrato_ate IS NOT NULL AND p.contrato_ate <= nova_temp
      AND t.clube_vendedor_id IS NOT NULL
    ORDER BY t.jogador_id, t.created_at DESC
  LOOP
    UPDATE public.players
      SET club_id = v_emprestimo.clube_origem_id, a_venda = false, a_emprestimo = false,
          contrato_ate = nova_temp + 1
      WHERE id = v_emprestimo.jogador_id;
    UPDATE public.transferencias SET status = 'finalizada'
      WHERE id = v_emprestimo.transferencia_id;
  END LOOP;

  UPDATE public.players p SET club_id = NULL, a_venda = false
    WHERE p.contrato_ate IS NOT NULL AND p.contrato_ate <= temp_atual AND p.club_id IS NOT NULL
      AND p.id NOT IN (
        SELECT DISTINCT t.jogador_id FROM public.transferencias t
        WHERE t.tipo = 'emprestimo' AND t.status IN ('aceita','finalizada') AND t.clube_vendedor_id IS NOT NULL
      );

  UPDATE public.players
    SET attributes = COALESCE(attributes,'{}'::jsonb) - 'propostas_recusadas' - 'unhappy_triggered_at'
    WHERE attributes ? 'propostas_recusadas' OR attributes ? 'unhappy_triggered_at';

  UPDATE public.players
    SET attributes = COALESCE(attributes,'{}'::jsonb) || jsonb_build_object(
      'dev_type',
      CASE WHEN random()<0.10 THEN 'flop' WHEN random()<0.25 THEN 'precoce'
           WHEN random()<0.55 THEN 'tardio' ELSE 'normal' END)
    WHERE attributes->>'dev_type' IS NULL AND habilidade IS NOT NULL;

  PERFORM public.processar_aposentadorias();
  PERFORM public.avisar_aposentadorias_proximas();
  UPDATE public.clubs SET posicao_ultima_temporada = NULL WHERE status = 'ativo';
  UPDATE public.settings SET value = jsonb_build_object('ano', nova_temp) WHERE key = 'temporada_atual';
  PERFORM public.gerar_propostas_externas();
  PERFORM encerrar_contratos_vencidos();
END
$function$;

-- Fix 2: External proposals — counter-proposal from user goes through AI review (status 'aguardando_ia')
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
    UPDATE public.external_proposals SET status = 'contraproposta' WHERE id = _id;
    -- Nova proposta entra como 'aguardando_ia': não aparece na inbox até a IA do clube comprador responder.
    INSERT INTO public.external_proposals(external_club_id, player_id, valor_ofertado, salario_ofertado,
      luvas, status, temporada_validade, parent_id, origem)
    VALUES (pr.external_club_id, pr.player_id, _novo_valor, _novo_salario,
      pr.luvas, 'aguardando_ia', pr.temporada_validade, pr.id, 'user_counter')
    RETURNING id INTO nova_id;
    RETURN nova_id;
  ELSE
    RAISE EXCEPTION 'Ação inválida';
  END IF;
END $function$;

-- Trigger: limite de 5 jogadores com bloqueio de propostas por clube
CREATE OR REPLACE FUNCTION public.enforce_block_proposals_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.bloquear_propostas = true
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.bloquear_propostas,false) = false)
     AND NEW.club_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
      FROM public.players
      WHERE club_id = NEW.club_id
        AND bloquear_propostas = true
        AND id <> NEW.id;
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'Limite de 5 jogadores com bloqueio de propostas atingido para este clube.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_proposals_limit ON public.players;
CREATE TRIGGER trg_block_proposals_limit
BEFORE INSERT OR UPDATE OF bloquear_propostas ON public.players
FOR EACH ROW EXECUTE FUNCTION public.enforce_block_proposals_limit();
