-- Atualiza scout_academy_player com a nova tabela de margens 12/9/6/3/1 e aplica desvio aleatório
CREATE OR REPLACE FUNCTION public.scout_academy_player(_scouter_club_id uuid, _target_player_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_club record;
  v_player record;
  v_report record;
  v_margem int;
  v_searches_used int;
  v_desvio_min int;
  v_desvio_max int;
  v_pmin int;
  v_pmax int;
BEGIN
  SELECT * INTO v_club FROM public.clubs WHERE id = _scouter_club_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado.'; END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR v_club.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para usar o olheiro deste clube';
  END IF;

  SELECT * INTO v_player FROM public.academy_players WHERE id = _target_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador da base não encontrado.'; END IF;

  SELECT * INTO v_report FROM public.scout_reports
    WHERE scouter_club_id = _scouter_club_id AND target_player_id = _target_player_id;

  IF FOUND THEN
    RETURN json_build_object(
      'potential_min', v_report.potential_min_revelado,
      'potential_max', v_report.potential_max_revelado,
      'margem', v_report.margem_aplicada,
      'searches_used', COALESCE(v_club.scout_searches_used, 0),
      'ja_existia', true
    );
  END IF;

  IF COALESCE(v_club.scout_searches_used, 0) >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 pesquisas atingido.';
  END IF;

  -- Margem proporcional ao nível da base: 1->12, 2->9, 3->6, 4->3, 5->1
  v_margem := CASE COALESCE(v_club.nivel_base, 1)
    WHEN 1 THEN 12
    WHEN 2 THEN 9
    WHEN 3 THEN 6
    WHEN 4 THEN 3
    WHEN 5 THEN 1
    ELSE 12
  END;

  v_desvio_min := -v_margem + floor(random() * (v_margem * 2 + 1))::int;
  v_desvio_max := -v_margem + floor(random() * (v_margem * 2 + 1))::int;
  v_pmin := GREATEST(45, LEAST(99, v_player.potential_min + v_desvio_min));
  v_pmax := GREATEST(v_pmin, LEAST(99, v_player.potential_max + v_desvio_max));

  INSERT INTO public.scout_reports (
    scouter_club_id, target_player_id,
    potential_min_revelado, potential_max_revelado, margem_aplicada
  ) VALUES (
    _scouter_club_id, _target_player_id, v_pmin, v_pmax, v_margem
  );

  v_searches_used := COALESCE(v_club.scout_searches_used, 0) + 1;
  UPDATE public.clubs SET scout_searches_used = v_searches_used WHERE id = _scouter_club_id;

  RETURN json_build_object(
    'potential_min', v_pmin,
    'potential_max', v_pmax,
    'margem', v_margem,
    'searches_used', v_searches_used,
    'ja_existia', false
  );
END;
$function$;

-- Recalcula margem_aplicada dos relatórios existentes com base no nivel_base atual do scouter
UPDATE public.scout_reports sr
SET margem_aplicada = CASE COALESCE(c.nivel_base, 1)
  WHEN 1 THEN 12
  WHEN 2 THEN 9
  WHEN 3 THEN 6
  WHEN 4 THEN 3
  WHEN 5 THEN 1
  ELSE 12
END
FROM public.clubs c
WHERE c.id = sr.scouter_club_id;