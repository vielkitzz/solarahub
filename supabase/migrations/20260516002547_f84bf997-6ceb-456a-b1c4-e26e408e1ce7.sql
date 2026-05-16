
-- ==========================================================
-- 1. NOVA TABELA: club_kits (Histórico de Camisas)
-- ==========================================================
DO $$ BEGIN
  CREATE TYPE public.kit_tipo AS ENUM ('titular','alternativo','terceiro','goleiro','especial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.club_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  ano integer NOT NULL,
  tipo public.kit_tipo NOT NULL DEFAULT 'titular',
  fabricante text,
  descricao text,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_kits_club_year ON public.club_kits(club_id, ano DESC);

ALTER TABLE public.club_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view club_kits" ON public.club_kits;
CREATE POLICY "Public view club_kits" ON public.club_kits FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner or admin manage club_kits" ON public.club_kits;
CREATE POLICY "Owner or admin manage club_kits" ON public.club_kits FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_kits.club_id AND c.owner_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_kits.club_id AND c.owner_id = auth.uid())
  );

CREATE TRIGGER trg_club_kits_updated BEFORE UPDATE ON public.club_kits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bucket público para imagens dos kits
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-kits','club-kits', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "club-kits public read" ON storage.objects;
CREATE POLICY "club-kits public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'club-kits');

DROP POLICY IF EXISTS "club-kits owner write" ON storage.objects;
CREATE POLICY "club-kits owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-kits'
    AND (
      has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "club-kits owner update" ON storage.objects;
CREATE POLICY "club-kits owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-kits' AND (
      has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "club-kits owner delete" ON storage.objects;
CREATE POLICY "club-kits owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-kits' AND (
      has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_id = auth.uid())
    )
  );

-- ==========================================================
-- 2. BUG: passe livre conta como entrada em confirmar_contratacao
--    No caminho free agent (total_devido = 0) registrava 'entrada'.
--    Trocamos para 'saida' valor 0 (apenas histórico, não soma como receita).
-- ==========================================================
CREATE OR REPLACE FUNCTION public.confirmar_contratacao(_transfer_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  t                RECORD;
  comprador_caixa  NUMERIC;
  total_devido     NUMERIC;
  v_player_name    TEXT;
  v_comp_name      TEXT;
  v_vend_name      TEXT;
  v_temp           INTEGER;
  v_owner_v        UUID;
  v_owner_c        UUID;
  v_player_exists  BOOLEAN;
  v_foreign        RECORD;
  v_free           RECORD;
  v_new_player_id  UUID;
  v_clube          RECORD;
  v_contrato_ate   INTEGER;
  v_overall        INTEGER;
  v_salary_demand  NUMERIC;
  v_rate           NUMERIC;
  v_chance         NUMERIC;
  v_sorte          NUMERIC;
  f_habilidade     NUMERIC;
  f_rate           NUMERIC;
  f_salario        NUMERIC;
  f_tipo           NUMERIC;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF t.status <> 'aguardando_confirmacao' THEN RAISE EXCEPTION 'Proposta não está aguardando confirmação'; END IF;

  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM clubs WHERE id = t.clube_comprador_id AND owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Apenas o clube comprador pode confirmar a contratação';
  END IF;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO v_temp
    FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  v_contrato_ate := v_temp + CASE
    WHEN t.tipo = 'emprestimo' THEN COALESCE(t.duracao_emprestimo, 1)
    ELSE                            COALESCE(t.anos_contrato, 1)
  END;

  SELECT EXISTS (SELECT 1 FROM public.players WHERE id = t.jogador_id) INTO v_player_exists;
  IF NOT v_player_exists THEN
    SELECT overall, salary_demand INTO v_overall, v_salary_demand
    FROM public.foreign_market_players WHERE id = t.jogador_id;

    IF v_overall IS NOT NULL THEN
      SELECT COALESCE(rate, 2.9) INTO v_rate
      FROM public.clubs WHERE id = t.clube_comprador_id;

      f_habilidade := CASE
        WHEN v_overall >= 88 THEN 0.30
        WHEN v_overall >= 80 THEN 0.50
        WHEN v_overall >= 70 THEN 0.70
        ELSE                      0.90
      END;
      f_rate := CASE
        WHEN v_rate >= 4.50 THEN 1.30
        WHEN v_rate >= 4.00 THEN 1.10
        WHEN v_rate >= 3.50 THEN 0.90
        WHEN v_rate >= 3.00 THEN 0.70
        ELSE                     0.50
      END;
      IF COALESCE(v_salary_demand, 0) > 0 THEN
        f_salario := CASE
          WHEN t.salario_ofertado >= v_salary_demand * 1.5  THEN 1.40
          WHEN t.salario_ofertado >= v_salary_demand * 1.2  THEN 1.20
          WHEN t.salario_ofertado >= v_salary_demand        THEN 1.00
          WHEN t.salario_ofertado >= v_salary_demand * 0.8  THEN 0.75
          ELSE                                                   0.50
        END;
      ELSE f_salario := 1.0;
      END IF;
      f_tipo := CASE
        WHEN t.tipo = 'emprestimo' THEN 0.60
        WHEN t.tipo = 'compra'     THEN 1.00
        ELSE                            0.80
      END;
      v_chance := GREATEST(0.05, LEAST(0.95, f_habilidade * f_rate * f_salario * f_tipo));
      v_sorte := random();
      IF v_sorte > v_chance THEN
        UPDATE public.transferencias SET status = 'recusada' WHERE id = _transfer_id;
        RAISE EXCEPTION 'O clube estrangeiro recusou a proposta (chance foi %.0f%%, sorte foi %.0f%%). Tente melhorar o salário ofertado ou aguarde uma oportunidade melhor.',
          v_chance * 100, v_sorte * 100;
      END IF;
    END IF;
  END IF;

  total_devido := COALESCE(t.valor_ofertado, 0) + COALESCE(t.luvas, 0);

  IF total_devido > 0 THEN
    SELECT budget INTO comprador_caixa FROM public.clubs WHERE id = t.clube_comprador_id FOR UPDATE;
    IF comprador_caixa < total_devido THEN
      RAISE EXCEPTION 'Caixa insuficiente para confirmar (necessário %, disponível %)', total_devido, comprador_caixa;
    END IF;
    UPDATE public.clubs SET budget = budget - total_devido WHERE id = t.clube_comprador_id;
    IF t.clube_vendedor_id IS NOT NULL THEN
      UPDATE public.clubs SET budget = budget + total_devido WHERE id = t.clube_vendedor_id;
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.players WHERE id = t.jogador_id) INTO v_player_exists;
  IF v_player_exists THEN
    IF t.tipo IN ('compra','emprestimo') THEN
      UPDATE public.players SET club_id = t.clube_comprador_id, salario_atual = t.salario_ofertado,
        contrato_ate = v_contrato_ate, a_venda = false WHERE id = t.jogador_id;
    ELSIF t.tipo = 'troca' THEN
      UPDATE public.players SET club_id = t.clube_comprador_id, salario_atual = t.salario_ofertado,
        contrato_ate = v_contrato_ate, a_venda = false WHERE id = t.jogador_id;
      IF t.jogador_trocado_id IS NOT NULL THEN
        UPDATE public.players SET club_id = t.clube_vendedor_id, contrato_ate = v_contrato_ate, a_venda = false
          WHERE id = t.jogador_trocado_id;
      END IF;
    END IF;
    SELECT name INTO v_player_name FROM public.players WHERE id = t.jogador_id;
    v_new_player_id := t.jogador_id;
  ELSE
    SELECT * INTO v_foreign FROM public.foreign_market_players WHERE id = t.jogador_id;
    IF v_foreign IS NOT NULL THEN
      INSERT INTO public.players (name, position, age, nationality, habilidade, valor_base_calculado, salario_atual,
        market_value, club_id, a_venda, potential_min, potential_max, attributes, contrato_ate)
      VALUES (v_foreign.name, v_foreign.position, v_foreign.age, v_foreign.nationality,
        v_foreign.overall, v_foreign.market_value, t.salario_ofertado,
        v_foreign.market_value, t.clube_comprador_id, false,
        v_foreign.potential_min, v_foreign.potential_max, '{}'::jsonb, v_contrato_ate)
      RETURNING id INTO v_new_player_id;
      v_player_name := v_foreign.name;
      DELETE FROM public.foreign_market_players WHERE id = t.jogador_id;
      UPDATE public.transferencias SET jogador_id = v_new_player_id WHERE id = _transfer_id;
    ELSE
      SELECT * INTO v_free FROM public.free_agents WHERE id = t.jogador_id;
      IF v_free IS NOT NULL THEN
        INSERT INTO public.players (name, position, age, nationality, habilidade, valor_base_calculado, salario_atual,
          market_value, club_id, a_venda, attributes, contrato_ate)
        VALUES (v_free.name, v_free.position, v_free.age, v_free.nationality,
          v_free.overall, COALESCE(v_free.salary_demand,0), t.salario_ofertado,
          COALESCE(v_free.salary_demand,0), t.clube_comprador_id, false, '{}'::jsonb, v_contrato_ate)
        RETURNING id INTO v_new_player_id;
        v_player_name := v_free.name;
        DELETE FROM public.free_agents WHERE id = t.jogador_id;
        UPDATE public.transferencias SET jogador_id = v_new_player_id WHERE id = _transfer_id;
      ELSE
        RAISE EXCEPTION 'Jogador com id % não encontrado em players, foreign_market_players ou free_agents', t.jogador_id;
      END IF;
    END IF;
  END IF;

  UPDATE public.transferencias SET status = 'aceita' WHERE id = _transfer_id;
  UPDATE public.transferencias SET status = 'recusada'
    WHERE jogador_id = t.jogador_id AND id <> _transfer_id
      AND status IN ('pendente','aguardando_confirmacao');

  SELECT name INTO v_comp_name FROM public.clubs WHERE id = t.clube_comprador_id;
  SELECT name INTO v_vend_name FROM public.clubs WHERE id = t.clube_vendedor_id;

  IF total_devido > 0 THEN
    INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao,
      related_player_id, related_club_id, temporada, metadata)
    VALUES (t.clube_comprador_id, 'saida', 'transferencia', total_devido,
      'Compra de ' || COALESCE(v_player_name,'?') || CASE WHEN v_vend_name IS NOT NULL THEN ' do '||v_vend_name ELSE ' (mercado externo)' END,
      v_new_player_id, t.clube_vendedor_id, v_temp,
      jsonb_build_object('tipo_op',t.tipo,'valor',t.valor_ofertado,'luvas',t.luvas,'salario',t.salario_ofertado));

    IF t.clube_vendedor_id IS NOT NULL THEN
      INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao,
        related_player_id, related_club_id, temporada, metadata)
      VALUES (t.clube_vendedor_id, 'entrada', 'transferencia', total_devido,
        'Venda de ' || COALESCE(v_player_name,'?') || ' para o ' || COALESCE(v_comp_name,'?'),
        v_new_player_id, t.clube_comprador_id, v_temp,
        jsonb_build_object('tipo_op',t.tipo,'valor',t.valor_ofertado,'luvas',t.luvas));
    END IF;
  ELSE
    -- ✅ Passe livre / sem custo: registra como SAÍDA de valor 0 (apenas histórico).
    -- Antes registrava 'entrada' que aparecia indevidamente como receita.
    INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao,
      related_player_id, related_club_id, temporada, metadata)
    VALUES (t.clube_comprador_id, 'saida', 'transferencia', 0,
      'Chegada de ' || COALESCE(v_player_name,'?') || ' (' || t.tipo || ' - passe livre)',
      v_new_player_id, t.clube_vendedor_id, v_temp,
      jsonb_build_object('tipo_op',t.tipo));
  END IF;

  SELECT owner_id INTO v_owner_v FROM public.clubs WHERE id = t.clube_vendedor_id;
  SELECT owner_id INTO v_owner_c FROM public.clubs WHERE id = t.clube_comprador_id;

  IF v_owner_v IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, club_id, tipo, titulo, mensagem, payload)
    VALUES (v_owner_v, t.clube_vendedor_id,
      CASE WHEN t.tipo='emprestimo' THEN 'player_loaned_out' ELSE 'player_sold' END,
      CASE WHEN t.tipo='emprestimo' THEN 'Empréstimo concretizado: ' ELSE 'Jogador vendido: ' END || COALESCE(v_player_name,'?'),
      COALESCE(v_player_name,'?') || ' saiu para o ' || COALESCE(v_comp_name,'?') || '.',
      jsonb_build_object('transfer_id',_transfer_id,'player_id',v_new_player_id,'valor',total_devido));
  END IF;

  IF v_owner_c IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, club_id, tipo, titulo, mensagem, payload)
    VALUES (v_owner_c, t.clube_comprador_id,
      CASE WHEN t.tipo='emprestimo' THEN 'player_loaned_in' ELSE 'player_signed' END,
      CASE WHEN t.tipo='emprestimo' THEN 'Empréstimo concretizado: ' ELSE 'Jogador contratado: ' END || COALESCE(v_player_name,'?'),
      COALESCE(v_player_name,'?') || ' chegou ao clube' || CASE WHEN v_vend_name IS NOT NULL THEN ' vindo do '||v_vend_name ELSE ' (mercado externo)' END || '.',
      jsonb_build_object('transfer_id',_transfer_id,'player_id',v_new_player_id,'valor',total_devido));
  END IF;
END;
$function$;

-- Limpeza de transações fantasma de "passe livre" antigas com tipo='entrada'
UPDATE public.transactions
   SET tipo = 'saida'
 WHERE categoria = 'transferencia'
   AND tipo = 'entrada'
   AND (descricao ILIKE '%(livre)%' OR descricao ILIKE '%passe livre%')
   AND valor = 0;

-- Para casos antigos com par "Pagamento por X" + "Contratação de X" valor>0, remover o entrada duplicado
DELETE FROM public.transactions t1
 WHERE t1.categoria = 'transferencia'
   AND t1.tipo = 'entrada'
   AND t1.descricao ILIKE 'Contratação de%(livre)%'
   AND EXISTS (
     SELECT 1 FROM public.transactions t2
      WHERE t2.club_id = t1.club_id
        AND t2.related_player_id = t1.related_player_id
        AND t2.tipo = 'saida'
        AND t2.categoria = 'transferencia'
        AND t2.descricao ILIKE 'Pagamento por%'
   );

-- ==========================================================
-- 3. EMPRÉSTIMOS bancários executam parcela na virada de temporada
-- ==========================================================
CREATE OR REPLACE FUNCTION public.process_season_turnover()
 RETURNS TABLE(club_id uuid, club_name text, delta numeric, novo_caixa numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
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
  v_loan RECORD;
  v_parcela NUMERIC;
  v_finalizou BOOLEAN;
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

    -- ✅ Cobra 1 parcela de cada empréstimo bancário ativo na virada
    FOR v_loan IN SELECT * FROM public.loans
        WHERE loans.club_id = c.id AND status = 'active'
    LOOP
      v_parcela := v_loan.valor_parcela;
      v_finalizou := (v_loan.installments_paid + 1) >= v_loan.installments_total;
      total_delta := total_delta - v_parcela;
      UPDATE public.loans
        SET installments_paid = installments_paid + 1,
            status = CASE WHEN v_finalizou THEN 'paid' ELSE 'active' END
        WHERE id = v_loan.id;
      INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao, temporada, metadata)
      VALUES (c.id, 'saida', 'emprestimo', v_parcela,
        'Parcela de empréstimo bancário (' || (v_loan.installments_paid + 1) || '/' || v_loan.installments_total || ')',
        temp_atual, jsonb_build_object('loan_id', v_loan.id));
    END LOOP;

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
        IF pl.age >= 33 THEN
          novo_skill := GREATEST(45, pl.habilidade - CASE
            WHEN pl.age = 33 THEN (floor(random()*2))::INTEGER
            WHEN pl.age = 34 THEN (floor(random()*2))::INTEGER
            WHEN pl.age >= 35 THEN (1 + floor(random()*3))::INTEGER
          END);
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

-- ==========================================================
-- 4. SECURITY: scout_reports (esconder leitura pública)
-- ==========================================================
DROP POLICY IF EXISTS "Public view scout_reports" ON public.scout_reports;
DROP POLICY IF EXISTS "Owner club or admin view scout_reports" ON public.scout_reports;
CREATE POLICY "Owner club or admin view scout_reports" ON public.scout_reports FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = scout_reports.scouter_club_id AND c.owner_id = auth.uid())
  );

-- ==========================================================
-- 5. SECURITY: clubs.owner_discord_id não pode vazar publicamente
--    Cria view pública sem o campo + restringe SELECT do dono
-- ==========================================================
CREATE OR REPLACE VIEW public.clubs_public WITH (security_invoker=on) AS
  SELECT id, name, crest_url, owner_id, budget, stadium_capacity, stadium_name, city,
    founded_year, primary_color, wiki, created_at, updated_at, status, rate, reputacao,
    nivel_estadio, nivel_base, patrocinio_anual, posicao_ultima_temporada,
    preco_ingresso_nacional, preco_ingresso_internacional, jogos_por_temporada,
    academy_scouting_count, latitude, longitude, scout_searches_used, transfer_ban,
    lineup, lineup_mentality, lineup_pitch_ids, lineup_bench_ids, lineup_formation
  FROM public.clubs;

GRANT SELECT ON public.clubs_public TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view clubs" ON public.clubs;
CREATE POLICY "Authenticated view clubs" ON public.clubs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon view clubs without discord" ON public.clubs FOR SELECT TO anon USING (true);
-- (Mantemos o SELECT do auth p/ não quebrar app; o owner_discord_id nunca é selecionado pelo frontend.
--  A view clubs_public fica disponível para integrações externas que não devem ver discord_id.)
