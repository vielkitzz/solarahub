-- Tipo de proposta
CREATE TYPE public.transfer_type AS ENUM ('compra', 'emprestimo', 'troca');

ALTER TABLE public.transferencias
  ADD COLUMN IF NOT EXISTS tipo transfer_type NOT NULL DEFAULT 'compra',
  ADD COLUMN IF NOT EXISTS jogador_trocado_id uuid,
  ADD COLUMN IF NOT EXISTS duracao_emprestimo integer;

-- Flag à venda no jogador
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS a_venda boolean NOT NULL DEFAULT false;

-- Atualiza accept_transfer para suportar tipos
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
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF t.status <> 'pendente' THEN RAISE EXCEPTION 'Proposta já processada'; END IF;

  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE id = t.clube_vendedor_id AND owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aceitar essa proposta';
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

  IF t.tipo = 'compra' THEN
    UPDATE public.players
      SET club_id = t.clube_comprador_id,
          salario_atual = t.salario_ofertado,
          a_venda = false
      WHERE id = t.jogador_id;
  ELSIF t.tipo = 'emprestimo' THEN
    -- empréstimo: jogador vai pro comprador temporariamente; passe permanece (controle manual no fim do prazo)
    UPDATE public.players
      SET club_id = t.clube_comprador_id,
          salario_atual = t.salario_ofertado,
          a_venda = false
      WHERE id = t.jogador_id;
  ELSIF t.tipo = 'troca' THEN
    -- jogador alvo vai pro comprador
    UPDATE public.players
      SET club_id = t.clube_comprador_id,
          salario_atual = t.salario_ofertado,
          a_venda = false
      WHERE id = t.jogador_id;
    -- jogador oferecido vai pro vendedor
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
END;
$function$;

-- Fair Play não deve bloquear empréstimo/troca (valor pode ser 0)
CREATE OR REPLACE FUNCTION public.validate_fair_play()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  vbase NUMERIC;
BEGIN
  IF NEW.tipo <> 'compra' THEN RETURN NEW; END IF;
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
$function$;