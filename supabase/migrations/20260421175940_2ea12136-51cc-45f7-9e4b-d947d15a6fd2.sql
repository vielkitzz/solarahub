-- 1. ENUMS
CREATE TYPE public.club_status AS ENUM ('ativo', 'inativo');
CREATE TYPE public.club_reputation AS ENUM ('estadual', 'nacional', 'continental', 'mundial');
CREATE TYPE public.transfer_status AS ENUM ('pendente', 'aceita', 'recusada');

-- 2. CLUBS — novos campos
ALTER TABLE public.clubs
  ADD COLUMN status public.club_status NOT NULL DEFAULT 'ativo',
  ADD COLUMN rate NUMERIC(4,2) NOT NULL DEFAULT 2.80,
  ADD COLUMN reputacao public.club_reputation,
  ADD COLUMN nivel_estadio INTEGER NOT NULL DEFAULT 1 CHECK (nivel_estadio BETWEEN 1 AND 5),
  ADD COLUMN nivel_base INTEGER NOT NULL DEFAULT 1 CHECK (nivel_base BETWEEN 1 AND 5);

-- 3. PLAYERS — novos campos
ALTER TABLE public.players
  ADD COLUMN overall INTEGER CHECK (overall BETWEEN 1 AND 99),
  ADD COLUMN valor_base_calculado NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN salario_atual NUMERIC NOT NULL DEFAULT 0;

-- 3a. Derivar overall do rating existente em attributes (rating 1-5 -> 20-100)
UPDATE public.players
SET overall = LEAST(99, GREATEST(1, ROUND(COALESCE((attributes->>'rating')::numeric, 3) * 20)::int))
WHERE overall IS NULL;

-- 4. Função de cálculo de valor base + salário
CREATE OR REPLACE FUNCTION public.calc_player_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base NUMERIC;
  mult NUMERIC := 1.0;
BEGIN
  IF NEW.overall IS NULL THEN
    RETURN NEW;
  END IF;
  base := NEW.overall * 100000;
  IF NEW.age IS NOT NULL THEN
    IF NEW.age <= 22 THEN mult := 1.5;
    ELSIF NEW.age >= 31 THEN mult := 0.7;
    END IF;
  END IF;
  NEW.valor_base_calculado := base * mult;
  NEW.salario_atual := NEW.valor_base_calculado * 0.10;
  -- Mantém market_value sincronizado com valor base para compatibilidade
  NEW.market_value := NEW.valor_base_calculado;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calc_player_value
BEFORE INSERT OR UPDATE OF overall, age ON public.players
FOR EACH ROW EXECUTE FUNCTION public.calc_player_value();

-- 4a. Recalcular para todos jogadores existentes
UPDATE public.players SET overall = overall WHERE overall IS NOT NULL;

-- 5. TRANSFERENCIAS
CREATE TABLE public.transferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jogador_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  clube_comprador_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  clube_vendedor_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  valor_ofertado NUMERIC NOT NULL CHECK (valor_ofertado >= 0),
  salario_ofertado NUMERIC NOT NULL CHECK (salario_ofertado >= 0),
  status public.transfer_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT diff_clubes CHECK (clube_comprador_id <> clube_vendedor_id)
);

CREATE INDEX idx_transferencias_vendedor ON public.transferencias(clube_vendedor_id, status);
CREATE INDEX idx_transferencias_comprador ON public.transferencias(clube_comprador_id, status);

ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view transferencias"
ON public.transferencias FOR SELECT
USING (true);

CREATE POLICY "Comprador cria proposta"
ON public.transferencias FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.clubs WHERE id = clube_comprador_id AND owner_id = auth.uid())
);

CREATE POLICY "Vendedor ou admin atualiza proposta"
ON public.transferencias FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.clubs WHERE id = clube_vendedor_id AND owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.clubs WHERE id = clube_comprador_id AND owner_id = auth.uid())
);

CREATE POLICY "Admin deleta transferencias"
ON public.transferencias FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_transferencias_updated_at
BEFORE UPDATE ON public.transferencias
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Trigger de Fair Play Financeiro
CREATE OR REPLACE FUNCTION public.validate_fair_play()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  vbase NUMERIC;
BEGIN
  SELECT valor_base_calculado INTO vbase FROM public.players WHERE id = NEW.jogador_id;
  IF vbase IS NULL OR vbase = 0 THEN
    RAISE EXCEPTION 'Jogador sem valor base calculado';
  END IF;
  IF NEW.valor_ofertado < vbase * 0.5 THEN
    RAISE EXCEPTION 'Oferta abaixo do mínimo de Fair Play (50%% do valor base = %).', (vbase * 0.5);
  END IF;
  IF NEW.valor_ofertado > vbase * 3.0 THEN
    RAISE EXCEPTION 'Oferta acima do máximo de Fair Play (300%% do valor base = %).', (vbase * 3.0);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fair_play
BEFORE INSERT ON public.transferencias
FOR EACH ROW EXECUTE FUNCTION public.validate_fair_play();

-- 7. Função para aceitar proposta (atômica)
CREATE OR REPLACE FUNCTION public.accept_transfer(_transfer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  comprador_caixa NUMERIC;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF t.status <> 'pendente' THEN RAISE EXCEPTION 'Proposta já processada'; END IF;

  -- Autorização: vendedor ou admin
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE id = t.clube_vendedor_id AND owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aceitar essa proposta';
  END IF;

  SELECT budget INTO comprador_caixa FROM public.clubs WHERE id = t.clube_comprador_id FOR UPDATE;
  IF comprador_caixa < t.valor_ofertado THEN
    RAISE EXCEPTION 'Clube comprador não tem caixa suficiente';
  END IF;

  -- Movimentações
  UPDATE public.clubs SET budget = budget - t.valor_ofertado WHERE id = t.clube_comprador_id;
  UPDATE public.clubs SET budget = budget + t.valor_ofertado WHERE id = t.clube_vendedor_id;
  UPDATE public.players
    SET club_id = t.clube_comprador_id,
        salario_atual = t.salario_ofertado
    WHERE id = t.jogador_id;
  UPDATE public.transferencias SET status = 'aceita' WHERE id = _transfer_id;

  -- Recusa automaticamente outras propostas pendentes pelo mesmo jogador
  UPDATE public.transferencias
    SET status = 'recusada'
    WHERE jogador_id = t.jogador_id AND id <> _transfer_id AND status = 'pendente';
END;
$$;

-- 8. Função de virada de temporada (admin)
CREATE OR REPLACE FUNCTION public.process_season_turnover()
RETURNS TABLE(club_id UUID, club_name TEXT, delta NUMERIC, novo_caixa NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  receita_base NUMERIC;
  bilheteria NUMERIC;
  manutencao NUMERIC;
  folha NUMERIC;
  total_delta NUMERIC;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar a virada de temporada';
  END IF;

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' LOOP
    receita_base := CASE c.reputacao
      WHEN 'estadual' THEN 4300000
      WHEN 'nacional' THEN 11500000
      WHEN 'continental' THEN 23000000
      WHEN 'mundial' THEN 45000000
      ELSE 0
    END;
    bilheteria := (c.nivel_estadio * 500000) * (c.rate / 3.0);
    manutencao := c.nivel_base * 300000;
    SELECT COALESCE(SUM(salario_atual), 0) INTO folha FROM public.players WHERE players.club_id = c.id;
    total_delta := receita_base + bilheteria - manutencao - folha;

    UPDATE public.clubs SET budget = budget + total_delta WHERE id = c.id;

    club_id := c.id;
    club_name := c.name;
    delta := total_delta;
    novo_caixa := c.budget + total_delta;
    RETURN NEXT;
  END LOOP;
END;
$$;