
-- 1) Margem do olheiro: 12, 9, 6, 3, 1 (proporcional ao nível da base)
CREATE OR REPLACE FUNCTION public.scout_player(_scouter_club_id UUID, _target_player_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  p RECORD;
  margem INTEGER;
  desvio_min INTEGER;
  desvio_max INTEGER;
  pmin_rev INTEGER;
  pmax_rev INTEGER;
  ja_existe BOOLEAN;
BEGIN
  SELECT * INTO c FROM public.clubs WHERE id = _scouter_club_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado'; END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR c.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para usar o olheiro deste clube';
  END IF;

  SELECT * INTO p FROM public.players WHERE id = _target_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;
  IF p.potential_max IS NULL THEN RAISE EXCEPTION 'Jogador sem potencial calculado'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.scout_reports
    WHERE scouter_club_id = _scouter_club_id AND target_player_id = _target_player_id
  ) INTO ja_existe;

  IF ja_existe THEN
    SELECT potential_min_revelado, potential_max_revelado, margem_aplicada
      INTO pmin_rev, pmax_rev, margem
      FROM public.scout_reports
      WHERE scouter_club_id = _scouter_club_id AND target_player_id = _target_player_id;
    RETURN jsonb_build_object(
      'potential_min', pmin_rev,
      'potential_max', pmax_rev,
      'margem', margem,
      'searches_used', c.scout_searches_used,
      'ja_existia', true
    );
  END IF;

  IF COALESCE(c.scout_searches_used, 0) >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 pesquisas do olheiro atingido nesta temporada';
  END IF;

  -- Margem proporcional ao nível da base: 1->12, 2->9, 3->6, 4->3, 5->1
  margem := CASE COALESCE(c.nivel_base, 1)
    WHEN 1 THEN 12
    WHEN 2 THEN 9
    WHEN 3 THEN 6
    WHEN 4 THEN 3
    WHEN 5 THEN 1
    ELSE 12
  END;

  desvio_min := -margem + floor(random() * (margem * 2 + 1))::INTEGER;
  desvio_max := -margem + floor(random() * (margem * 2 + 1))::INTEGER;

  pmin_rev := GREATEST(45, LEAST(99, p.potential_min + desvio_min));
  pmax_rev := GREATEST(pmin_rev, LEAST(99, p.potential_max + desvio_max));

  INSERT INTO public.scout_reports (scouter_club_id, target_player_id, potential_min_revelado, potential_max_revelado, margem_aplicada)
  VALUES (_scouter_club_id, _target_player_id, pmin_rev, pmax_rev, margem);

  UPDATE public.clubs SET scout_searches_used = COALESCE(scout_searches_used, 0) + 1 WHERE id = _scouter_club_id;

  RETURN jsonb_build_object(
    'potential_min', pmin_rev,
    'potential_max', pmax_rev,
    'margem', margem,
    'searches_used', c.scout_searches_used + 1,
    'ja_existia', false
  );
END;
$$;

-- 2) Bloqueio de marca temporário (apenas 1 temporada)
ALTER TABLE public.marcas_bloqueadas
  ADD COLUMN IF NOT EXISTS bloqueada_ate_temporada INTEGER;

-- Trigger atualizado: registra bloqueio com prazo de 1 temporada
CREATE OR REPLACE FUNCTION public.bloquear_marca_apos_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_nome TEXT;
  temp_atual INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.ativo = true AND NEW.ativo = false AND NEW.empresa_id IS NOT NULL THEN
    SELECT nome INTO emp_nome FROM public.empresas WHERE id = NEW.empresa_id;
    SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
      FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;
    IF emp_nome IS NOT NULL THEN
      INSERT INTO public.marcas_bloqueadas (club_id, empresa_nome, motivo, bloqueada_ate_temporada)
      VALUES (NEW.club_id, emp_nome, 'Contrato encerrado/rescindido', temp_atual)
      ON CONFLICT (club_id, empresa_nome)
      DO UPDATE SET bloqueada_ate_temporada = EXCLUDED.bloqueada_ate_temporada,
                    motivo = EXCLUDED.motivo,
                    created_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Validação: só bloqueia se ainda dentro do prazo
CREATE OR REPLACE FUNCTION public.validar_contrato_patrocinio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  emp RECORD;
  prestigio NUMERIC;
  rep_rank INTEGER;
  setor_lower TEXT;
  temp_atual INTEGER;
BEGIN
  IF NEW.empresa_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO c FROM public.clubs WHERE id = NEW.club_id;
  SELECT * INTO emp FROM public.empresas WHERE id = NEW.empresa_id;
  IF c IS NULL OR emp IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE((value->>'ano')::int, 2026) INTO temp_atual
    FROM public.settings WHERE key = 'temporada_atual' LIMIT 1;

  -- Bloqueio temporário: vigente apenas enquanto current_season <= bloqueada_ate_temporada
  IF EXISTS (
    SELECT 1 FROM public.marcas_bloqueadas
    WHERE club_id = NEW.club_id
      AND lower(empresa_nome) = lower(emp.nome)
      AND COALESCE(bloqueada_ate_temporada, 0) >= temp_atual
  ) THEN
    RAISE EXCEPTION 'A marca % está bloqueada com esse clube nesta temporada. Será liberada na próxima temporada.', emp.nome;
  END IF;

  rep_rank := CASE lower(coalesce(c.reputacao::text, ''))
    WHEN 'local' THEN 1
    WHEN 'estadual' THEN 2
    WHEN 'nacional' THEN 3
    WHEN 'continental' THEN 4
    WHEN 'mundial' THEN 5
    ELSE 0
  END;

  prestigio := CASE
    WHEN emp.valor_anual_sugerido >= 8000000 THEN 1.5
    WHEN emp.valor_anual_sugerido >= 5000000 THEN 1.1
    ELSE 0.9
  END;

  setor_lower := lower(coalesce(emp.exigencias, ''));

  IF c.rate < 3.05
     AND rep_rank < 3
     AND prestigio > 1.5
     AND NEW.categoria::text NOT IN ('fornecedora')
     AND setor_lower NOT LIKE '%casa de apostas%'
     AND setor_lower NOT LIKE '%aposta%'
  THEN
    RAISE EXCEPTION 'Clube com rate % e reputação % não pode contratar marcas de prestígio acima de 1.50 (exceto fornecedoras e casas de apostas).', c.rate, c.reputacao;
  END IF;

  RETURN NEW;
END;
$$;

-- Limpa bloqueios antigos (sem prazo definido) para não manter bloqueios permanentes residuais
UPDATE public.marcas_bloqueadas
  SET bloqueada_ate_temporada = 0
  WHERE bloqueada_ate_temporada IS NULL;
