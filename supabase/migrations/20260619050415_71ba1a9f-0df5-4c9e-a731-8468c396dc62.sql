-- Ajuste de dados da base
UPDATE public.academy_players
SET potential_max = 65,
    potential_min = LEAST(potential_min, 65),
    skill = LEAST(skill, 65)
WHERE potential_max > 65 OR potential_min > 65 OR skill > 65;

-- Trigger garantindo teto de 65 na base
CREATE OR REPLACE FUNCTION public.enforce_academy_cap()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.potential_max IS NULL OR NEW.potential_max > 65 THEN
    NEW.potential_max := 65;
  END IF;
  IF NEW.potential_min IS NOT NULL AND NEW.potential_min > NEW.potential_max THEN
    NEW.potential_min := NEW.potential_max;
  END IF;
  IF NEW.skill IS NOT NULL AND NEW.skill > NEW.potential_max THEN
    NEW.skill := NEW.potential_max;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_academy_cap ON public.academy_players;
CREATE TRIGGER trg_enforce_academy_cap
  BEFORE INSERT OR UPDATE ON public.academy_players
  FOR EACH ROW EXECUTE FUNCTION public.enforce_academy_cap();

-- Recria process_season_turnover com nova lógica de evolução (mesma assinatura TABLE)
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
  v_gain_min INT; v_gain_max INT;
  v_age_factor NUMERIC; v_pot_factor NUMERIC; v_headroom INT;
  v_raw_gain NUMERIC; v_ganho INT;
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
    -- Base sempre limitada a 65
    v_skill_cap := LEAST(65, ROUND(v_club_rate * 7 + 42)::INTEGER + 5);

    FOR ap IN SELECT * FROM public.academy_players WHERE academy_players.club_id = c.id LOOP
      IF ap.development_progress >= 100 THEN
        UPDATE public.academy_players
          SET seasons_in_academy = ap.seasons_in_academy + 1, age = ap.age + 1
          WHERE id = ap.id;
      ELSE
        v_teto_efetivo := LEAST(LEAST(ap.potential_max, v_skill_cap), 65);
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
        -- Tetos por idade
        IF pl.age <= 25 THEN
          v_gain_min := 3; v_gain_max := 5;
        ELSE
          v_gain_min := 1; v_gain_max := 3;
        END IF;

        -- Ponderação por idade (curva de evolução)
        v_age_factor := CASE
          WHEN pl.age <= 18 THEN 1.20
          WHEN pl.age <= 21 THEN 1.10
          WHEN pl.age <= 25 THEN 1.00
          WHEN pl.age <= 28 THEN 0.85
          ELSE                    0.70
        END;

        -- Ponderação por potencial: maior potencial → mais perto do teto
        v_pot_factor := GREATEST(0.55, LEAST(1.20, v_pot_max_atual::numeric / 85.0));
        v_headroom   := GREATEST(0, v_pot_max_atual - pl.habilidade);

        v_raw_gain := (v_gain_min + random() * ((v_gain_max - v_gain_min) + 1))
                      * v_age_factor * v_pot_factor * v_evolucao_mult;

        v_ganho := GREATEST(0, LEAST(v_gain_max, LEAST(v_headroom, ROUND(v_raw_gain)::INT)));
        novo_skill := LEAST(v_pot_max_atual, pl.habilidade + v_ganho);
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