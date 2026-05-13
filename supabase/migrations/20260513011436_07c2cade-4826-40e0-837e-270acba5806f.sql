
-- 1. Coluna de escalação salva
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS lineup jsonb;

-- 2. Fix duplicidade entrada+saida em contratações estrangeiras / passe livre
CREATE OR REPLACE FUNCTION public.contratar_jogador_direto(_clube_id uuid, _jogador_id uuid, _salario numeric, _luvas numeric, _valor numeric, _tipo text, _user_id uuid, _anos_contrato integer, _percentual_revenda numeric DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  p RECORD;
  c RECORD;
  fp RECORD;
  fa RECORD;
  total_devido NUMERIC;
  temp_atual INTEGER;
  real_player_id UUID;
  player_name TEXT;
BEGIN
  SELECT * INTO c FROM public.clubs WHERE id = _clube_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado'; END IF;

  IF NOT (
    has_role(_user_id, 'admin'::app_role)
    OR c.owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Sem permissão para contratar jogador';
  END IF;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
  FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  SELECT * INTO p FROM public.players WHERE id = _jogador_id;

  IF NOT FOUND THEN
    SELECT * INTO fp FROM public.foreign_market_players WHERE id = _jogador_id;

    IF FOUND THEN
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

    -- Apenas SAÍDA (compra). Removido o INSERT duplicado de 'entrada' que duplicava no extrato.
    INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao, related_player_id, temporada, metadata)
    VALUES (
      _clube_id, 'saida', 'transferencia', total_devido,
      'Contratação de ' || COALESCE(player_name, '?') || ' (' || _tipo || ')',
      real_player_id, temp_atual,
      jsonb_build_object('tipo_op', _tipo, 'valor', _valor, 'luvas', _luvas, 'salario', _salario)
    );
  ELSE
    -- Passe livre: registra um lançamento de valor 0 só pra histórico
    INSERT INTO public.transactions (club_id, tipo, categoria, valor, descricao, related_player_id, temporada, metadata)
    VALUES (
      _clube_id, 'saida', 'transferencia', 0,
      'Contratação de ' || COALESCE(player_name, '?') || ' (' || _tipo || ' - passe livre)',
      real_player_id, temp_atual,
      jsonb_build_object('tipo_op', _tipo, 'valor', 0, 'luvas', 0, 'salario', _salario)
    );
  END IF;
END;
$function$;
