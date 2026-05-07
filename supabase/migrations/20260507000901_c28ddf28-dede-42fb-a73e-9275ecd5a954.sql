
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.external_region AS ENUM ('europeu', 'brasileiro', 'arabe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.external_budget_tier AS ENUM ('baixo', 'medio', 'alto', 'elite');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.external_proposal_status AS ENUM ('pendente', 'aceita', 'recusada', 'contraproposta', 'expirada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ FOREIGN MARKET PLAYERS ============
CREATE TABLE IF NOT EXISTS public.foreign_market_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position text NOT NULL,
  age integer,
  nationality text,
  overall integer NOT NULL DEFAULT 70,
  market_value numeric NOT NULL DEFAULT 0,
  salary_demand numeric NOT NULL DEFAULT 0,
  club_origin text,
  league_origin text,
  temporada integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.foreign_market_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view foreign_market_players" ON public.foreign_market_players FOR SELECT USING (true);
CREATE POLICY "Admin manage foreign_market_players" ON public.foreign_market_players FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_foreign_market_players_updated_at BEFORE UPDATE ON public.foreign_market_players
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FREE AGENTS ============
CREATE TABLE IF NOT EXISTS public.free_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position text NOT NULL,
  age integer,
  nationality text,
  overall integer NOT NULL DEFAULT 65,
  salary_demand numeric NOT NULL DEFAULT 0,
  last_club text,
  temporada integer,
  source_player_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.free_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view free_agents" ON public.free_agents FOR SELECT USING (true);
CREATE POLICY "Admin manage free_agents" ON public.free_agents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_free_agents_updated_at BEFORE UPDATE ON public.free_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ EXTERNAL CLUBS ============
CREATE TABLE IF NOT EXISTS public.external_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  league text,
  region public.external_region NOT NULL DEFAULT 'europeu',
  budget_tier public.external_budget_tier NOT NULL DEFAULT 'medio',
  prestige integer NOT NULL DEFAULT 5 CHECK (prestige BETWEEN 1 AND 10),
  active boolean NOT NULL DEFAULT true,
  crest text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.external_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view external_clubs" ON public.external_clubs FOR SELECT USING (true);
CREATE POLICY "Admin manage external_clubs" ON public.external_clubs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_external_clubs_updated_at BEFORE UPDATE ON public.external_clubs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ EXTERNAL PROPOSALS ============
CREATE TABLE IF NOT EXISTS public.external_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  valor_ofertado numeric NOT NULL DEFAULT 0,
  salario_ofertado numeric NOT NULL DEFAULT 0,
  luvas numeric NOT NULL DEFAULT 0,
  status public.external_proposal_status NOT NULL DEFAULT 'pendente',
  temporada_validade integer,
  parent_id uuid,
  origem text NOT NULL DEFAULT 'auto', -- auto | ai_counter | user_counter
  mensagem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.external_proposals ENABLE ROW LEVEL SECURITY;

-- Dono do clube do jogador OU admin pode ver
CREATE POLICY "Owner of player club or admin view external_proposals" ON public.external_proposals FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.players p
    JOIN public.clubs c ON c.id = p.club_id
    WHERE p.id = external_proposals.player_id AND c.owner_id = auth.uid()
  )
);
-- Update só admin (responder via RPC SECURITY DEFINER faz o trabalho)
CREATE POLICY "Admin update external_proposals" ON public.external_proposals FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin delete external_proposals" ON public.external_proposals FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin insert external_proposals" ON public.external_proposals FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_external_proposals_updated_at BEFORE UPDATE ON public.external_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_external_proposals_player ON public.external_proposals(player_id);
CREATE INDEX IF NOT EXISTS idx_external_proposals_status ON public.external_proposals(status);

-- ============ FAIR PLAY ESTENDIDO (500%) ============
CREATE OR REPLACE FUNCTION public.validate_fair_play_external()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE vbase numeric;
BEGIN
  SELECT valor_base_calculado INTO vbase FROM public.players WHERE id = NEW.player_id;
  IF vbase IS NULL OR vbase = 0 THEN RETURN NEW; END IF;
  IF NEW.valor_ofertado < vbase * 0.5 THEN
    RAISE EXCEPTION 'Oferta externa abaixo do mínimo (50%% = %).', (vbase * 0.5);
  END IF;
  IF NEW.valor_ofertado > vbase * 5.0 THEN
    RAISE EXCEPTION 'Oferta externa acima do máximo (500%% = %).', (vbase * 5.0);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_fair_play_external ON public.external_proposals;
CREATE TRIGGER trg_validate_fair_play_external
  BEFORE INSERT ON public.external_proposals
  FOR EACH ROW EXECUTE FUNCTION public.validate_fair_play_external();

-- ============ FUNÇÃO: GERAR PROPOSTAS ============
CREATE OR REPLACE FUNCTION public.gerar_propostas_externas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ec record;
  pl record;
  temp_atual integer;
  tier_mult numeric;
  v_valor numeric;
  v_salario numeric;
  v_owner uuid;
  total integer := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem gerar propostas';
  END IF;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  FOR ec IN SELECT * FROM public.external_clubs WHERE active = true LOOP
    tier_mult := CASE ec.budget_tier
      WHEN 'baixo' THEN 0.85
      WHEN 'medio' THEN 1.0
      WHEN 'alto'  THEN 1.25
      WHEN 'elite' THEN 1.6
    END;

    FOR pl IN
      SELECT p.* FROM public.players p
      JOIN public.clubs c ON c.id = p.club_id
      WHERE c.owner_id IS NOT NULL
        AND p.valor_base_calculado > 0
        AND (
          p.habilidade >= 81
          OR (p.habilidade < 81 AND ec.prestige <= 3)
          OR p.a_venda = true
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.external_proposals ep
          WHERE ep.player_id = p.id
            AND ep.external_club_id = ec.id
            AND ep.status = 'pendente'
        )
    LOOP
      v_valor   := ROUND(pl.valor_base_calculado * (0.8 + ec.prestige * 0.05) * tier_mult);
      v_salario := ROUND(GREATEST(pl.salario_atual, 1) * (1.1 + ec.prestige * 0.03) * tier_mult);
      -- Garantir dentro do fair play 50%-500%
      v_valor := GREATEST(ROUND(pl.valor_base_calculado * 0.55), LEAST(v_valor, ROUND(pl.valor_base_calculado * 4.9)));

      BEGIN
        INSERT INTO public.external_proposals(external_club_id, player_id, valor_ofertado, salario_ofertado, temporada_validade)
        VALUES (ec.id, pl.id, v_valor, v_salario, temp_atual);
        total := total + 1;

        SELECT owner_id INTO v_owner FROM public.clubs WHERE id = pl.club_id;
        IF v_owner IS NOT NULL THEN
          INSERT INTO public.notifications(user_id, club_id, tipo, titulo, mensagem, payload)
          VALUES (v_owner, pl.club_id, 'proposta_externa',
                  'Proposta de ' || ec.name,
                  ec.name || ' fez uma oferta por ' || pl.name || ' no valor de ' || v_valor::text,
                  jsonb_build_object('external_club_id', ec.id, 'player_id', pl.id, 'valor', v_valor));
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- ignora violações de fair play e segue
        CONTINUE;
      END;
    END LOOP;
  END LOOP;

  RETURN total;
END $$;

-- ============ FUNÇÃO: EXPIRAR ============
CREATE OR REPLACE FUNCTION public.expirar_propostas_externas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.external_proposals SET status = 'expirada' WHERE status = 'pendente';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ============ FUNÇÃO: RESPONDER ============
CREATE OR REPLACE FUNCTION public.responder_proposta_externa(
  _id uuid, _acao text, _novo_valor numeric DEFAULT NULL, _novo_salario numeric DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pr record;
  pl record;
  cl record;
  ec record;
  total_devido numeric;
  v_temp integer;
  nova_id uuid;
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
    total_devido := pr.valor_ofertado + pr.luvas;
    UPDATE public.clubs SET budget = budget + total_devido WHERE id = pl.club_id;
    UPDATE public.players SET club_id = NULL, a_venda = false, salario_atual = 0, contrato_ate = NULL WHERE id = pl.id;
    UPDATE public.external_proposals SET status = 'aceita' WHERE id = _id;
    UPDATE public.external_proposals SET status = 'recusada'
      WHERE player_id = pl.id AND id <> _id AND status = 'pendente';

    INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, related_player_id, temporada, metadata)
    VALUES (pl.club_id, 'entrada', 'transferencia_externa', total_devido,
            'Venda de ' || pl.name || ' para ' || ec.name || ' (' || ec.country || ')',
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
END $$;

-- ============ ATUALIZAR process_season_turnover (acrescenta expiração + geração) ============
CREATE OR REPLACE FUNCTION public.process_season_turnover()
 RETURNS TABLE(club_id uuid, club_name text, delta numeric, novo_caixa numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c               RECORD;
  ap              RECORD;
  pl              RECORD;
  v_tv            NUMERIC;
  bilheteria      NUMERIC;
  manutencao      NUMERIC;
  folha           NUMERIC;
  contratos       NUMERIC;
  premiacao       NUMERIC;
  total_delta     NUMERIC;
  temp_atual      INTEGER;
  nova_temp       INTEGER;
  ganho_progresso NUMERIC;
  mult_base       NUMERIC;
  novo_skill      INTEGER;
  preco_medio     NUMERIC;
  jogos           INTEGER;
  econ            JSONB;
  manut_por_nivel NUMERIC;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar a virada de temporada';
  END IF;

  -- Expira propostas externas pendentes e gera novas (NOVO)
  PERFORM public.expirar_propostas_externas();

  SELECT value INTO econ FROM public.settings WHERE key = 'economia_params' LIMIT 1;
  manut_por_nivel := COALESCE((econ->>'manutencao_por_nivel_base')::numeric, 300000);

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;
  nova_temp := temp_atual + 1;

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' LOOP
    v_tv        := public.get_tv_rights_value(c.id);
    preco_medio := (COALESCE(c.preco_ingresso_nacional, 0)
                  + COALESCE(c.preco_ingresso_internacional, 0)) / 2.0;
    jogos       := COALESCE(c.jogos_por_temporada, 38);
    bilheteria  := COALESCE(c.stadium_capacity, 0)
                   * 0.85 * preco_medio * jogos * (c.rate / 3.0);
    manutencao  := c.nivel_base * manut_por_nivel;
    premiacao   := public.premiacao_clube_temporada(c.id, temp_atual);

    SELECT COALESCE(SUM(salario_atual), 0) INTO folha
    FROM public.players WHERE players.club_id = c.id;

    SELECT COALESCE(SUM(valor_anual), 0) INTO contratos
    FROM public.contratos_clube
    WHERE contratos_clube.club_id = c.id AND ativo = true;

    total_delta := v_tv + bilheteria + contratos + premiacao - manutencao - folha;

    UPDATE public.clubs SET budget = budget + total_delta WHERE id = c.id;

    IF v_tv > 0 THEN
      INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, temporada)
      VALUES (c.id, 'entrada', 'tv', v_tv, 'Direitos de TV (temp ' || temp_atual || ')', temp_atual);
    END IF;
    IF bilheteria > 0 THEN
      INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, temporada)
      VALUES (c.id, 'entrada', 'bilheteria', bilheteria, 'Bilheteria anual (temp ' || temp_atual || ')', temp_atual);
    END IF;
    IF contratos > 0 THEN
      INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, temporada)
      VALUES (c.id, 'entrada', 'patrocinio', contratos, 'Patrocínios anuais (temp ' || temp_atual || ')', temp_atual);
    END IF;
    IF premiacao > 0 THEN
      INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, temporada)
      VALUES (c.id, 'entrada', 'premiacao', premiacao, 'Premiações de torneios (temp ' || temp_atual || ')', temp_atual);
    END IF;
    IF manutencao > 0 THEN
      INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, temporada)
      VALUES (c.id, 'saida', 'manutencao', manutencao, 'Manutenção de base/estádio (temp ' || temp_atual || ')', temp_atual);
    END IF;
    IF folha > 0 THEN
      INSERT INTO public.transactions(club_id, tipo, categoria, valor, descricao, temporada)
      VALUES (c.id, 'saida', 'salario', folha, 'Folha salarial (temp ' || temp_atual || ')', temp_atual);
    END IF;

    mult_base := CASE c.nivel_base
      WHEN 1 THEN 0.80 WHEN 2 THEN 0.95 WHEN 3 THEN 1.10
      WHEN 4 THEN 1.20 WHEN 5 THEN 1.30 ELSE 1.0
    END;

    FOR ap IN SELECT * FROM public.academy_players WHERE academy_players.club_id = c.id LOOP
      ganho_progresso := CASE
        WHEN ap.age <= 18 THEN 15 + random() * 5
        WHEN ap.age <= 21 THEN 10 + random() * 5
        ELSE                    5 + random() * 5
      END * mult_base;

      IF ap.development_progress < 100 THEN
        novo_skill := LEAST(ap.potential_max,
          ap.skill + ROUND(((ap.potential_max - ap.skill) * (ganho_progresso / 100.0)))::INTEGER);
        UPDATE public.academy_players
        SET development_progress = LEAST(100, ap.development_progress + ganho_progresso),
            skill = novo_skill,
            seasons_in_academy = ap.seasons_in_academy + 1,
            age = ap.age + 1
        WHERE id = ap.id;
      END IF;
    END LOOP;

    FOR pl IN SELECT * FROM public.players WHERE players.club_id = c.id LOOP
      IF pl.age IS NOT NULL AND pl.habilidade IS NOT NULL AND pl.potential_max IS NOT NULL THEN
        IF pl.age >= 31 THEN
          novo_skill := GREATEST(45, pl.habilidade - (1 + floor(random() * 3))::INTEGER);
        ELSIF pl.age <= 27 AND pl.habilidade < pl.potential_max THEN
          novo_skill := LEAST(pl.potential_max, pl.habilidade + (1 + floor(random() * 3))::INTEGER);
        ELSE
          novo_skill := pl.habilidade;
        END IF;
        UPDATE public.players
        SET habilidade = novo_skill, habilidade_anterior = pl.habilidade, age = pl.age + 1
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
  UPDATE public.clubs SET posicao_ultima_temporada = NULL WHERE status = 'ativo';
  UPDATE public.settings SET value = jsonb_build_object('ano', nova_temp) WHERE key = 'temporada_atual';

  -- Gera novas propostas externas para a próxima janela (NOVO)
  PERFORM public.gerar_propostas_externas();
END;
$function$;

-- ============ MIGRAR JOGADORES SEM CLUBE PARA free_agents (idempotente) ============
INSERT INTO public.free_agents (name, position, age, nationality, overall, salary_demand, last_club, temporada, source_player_id)
SELECT p.name, p.position, p.age, p.nationality, COALESCE(p.habilidade, 65),
       COALESCE(p.salario_atual, 0),
       NULL,
       (SELECT COALESCE((value->>'ano')::int, 2026) FROM public.settings WHERE key = 'temporada_atual' LIMIT 1),
       p.id
FROM public.players p
WHERE p.club_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.free_agents fa WHERE fa.source_player_id = p.id);
