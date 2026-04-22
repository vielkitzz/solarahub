-- Novos campos no clube
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS patrocinio_anual NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posicao_ultima_temporada INTEGER;

-- Luvas nas propostas
ALTER TABLE public.transferencias
  ADD COLUMN IF NOT EXISTS luvas NUMERIC NOT NULL DEFAULT 0;

-- Função de premiação por posição
CREATE OR REPLACE FUNCTION public.premiacao_por_posicao(_pos integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _pos IS NULL THEN 0
    WHEN _pos = 1 THEN 20000000
    WHEN _pos = 2 THEN 12000000
    WHEN _pos = 3 THEN 8000000
    WHEN _pos = 4 THEN 5000000
    WHEN _pos BETWEEN 5 AND 8 THEN 3000000
    WHEN _pos BETWEEN 9 AND 12 THEN 1500000
    WHEN _pos BETWEEN 13 AND 16 THEN 750000
    WHEN _pos BETWEEN 17 AND 20 THEN 300000
    ELSE 0
  END;
$$;

-- Atualiza virada de temporada para incluir patrocínio e premiação
CREATE OR REPLACE FUNCTION public.process_season_turnover()
 RETURNS TABLE(club_id uuid, club_name text, delta numeric, novo_caixa numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
  receita_base NUMERIC;
  bilheteria NUMERIC;
  manutencao NUMERIC;
  folha NUMERIC;
  patrocinio NUMERIC;
  premiacao NUMERIC;
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
    patrocinio := COALESCE(c.patrocinio_anual, 0);
    premiacao := premiacao_por_posicao(c.posicao_ultima_temporada);
    SELECT COALESCE(SUM(salario_atual), 0) INTO folha FROM public.players WHERE players.club_id = c.id;
    total_delta := receita_base + bilheteria + patrocinio + premiacao - manutencao - folha;

    UPDATE public.clubs SET budget = budget + total_delta WHERE id = c.id;

    club_id := c.id;
    club_name := c.name;
    delta := total_delta;
    novo_caixa := c.budget + total_delta;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- Atualiza accept_transfer para incluir luvas
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

  total_devido := t.valor_ofertado + COALESCE(t.luvas, 0);

  SELECT budget INTO comprador_caixa FROM public.clubs WHERE id = t.clube_comprador_id FOR UPDATE;
  IF comprador_caixa < total_devido THEN
    RAISE EXCEPTION 'Clube comprador não tem caixa suficiente (necessário: %, disponível: %)', total_devido, comprador_caixa;
  END IF;

  UPDATE public.clubs SET budget = budget - total_devido WHERE id = t.clube_comprador_id;
  UPDATE public.clubs SET budget = budget + total_devido WHERE id = t.clube_vendedor_id;
  UPDATE public.players
    SET club_id = t.clube_comprador_id,
        salario_atual = t.salario_ofertado
    WHERE id = t.jogador_id;
  UPDATE public.transferencias SET status = 'aceita' WHERE id = _transfer_id;

  UPDATE public.transferencias
    SET status = 'recusada'
    WHERE jogador_id = t.jogador_id AND id <> _transfer_id AND status = 'pendente';
END;
$function$;