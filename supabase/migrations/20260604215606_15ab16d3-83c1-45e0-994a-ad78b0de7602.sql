
-- =============================================================
-- 1. clubs: esconder owner_discord_id de anônimos
-- =============================================================
REVOKE SELECT ON public.clubs FROM anon;
GRANT SELECT (
  id, name, city, primary_color, wiki, created_at, updated_at, status, rate,
  reputacao, nivel_estadio, nivel_base, patrocinio_anual, posicao_ultima_temporada,
  preco_ingresso_nacional, preco_ingresso_internacional, founded_year,
  academy_scouting_count, latitude, longitude, scout_searches_used, transfer_ban,
  lineup, lineup_formation, lineup_mentality, lineup_pitch_ids, lineup_bench_ids,
  stadium_name, stadium_capacity, budget, owner_id, crest_url,
  jogos_por_temporada
) ON public.clubs TO anon;
-- 'owner_discord_id' deliberately omitted for anon.

-- =============================================================
-- 2. kit_ratings: tirar leitura anônima
-- =============================================================
DROP POLICY IF EXISTS "Public view kit_ratings" ON public.kit_ratings;
CREATE POLICY "Authenticated view kit_ratings"
ON public.kit_ratings FOR SELECT TO authenticated USING (true);

-- =============================================================
-- 3. notifications: apenas admins criam
-- =============================================================
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Admins insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =============================================================
-- 4. Tabelas com leitura pública agora exigem login
-- =============================================================
DROP POLICY IF EXISTS "Public view transactions" ON public.transactions;
CREATE POLICY "Authenticated view transactions"
ON public.transactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public view contratos" ON public.contratos_clube;
CREATE POLICY "Authenticated view contratos"
ON public.contratos_clube FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public view player_trainings" ON public.player_trainings;
CREATE POLICY "Authenticated view player_trainings"
ON public.player_trainings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public view transferencias" ON public.transferencias;
CREATE POLICY "Authenticated view transferencias"
ON public.transferencias FOR SELECT TO authenticated USING (true);

-- Mais sensíveis: só dono ou admin
DROP POLICY IF EXISTS "Public view loans" ON public.loans;
CREATE POLICY "Owner or admin view loans"
ON public.loans FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = loans.club_id AND c.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Public view marcas_bloqueadas" ON public.marcas_bloqueadas;
CREATE POLICY "Owner or admin view marcas_bloqueadas"
ON public.marcas_bloqueadas FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = marcas_bloqueadas.club_id AND c.owner_id = auth.uid())
);

-- =============================================================
-- 5. Storage: remover políticas frouxas
-- =============================================================
-- kits: as políticas "kits owner insert/update/delete" já restringem por pasta.
DROP POLICY IF EXISTS "Owner upload kits" ON storage.objects;
DROP POLICY IF EXISTS "Owner update kits" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete kits" ON storage.objects;

-- crests: "Permitir upload no crests" permite qualquer autenticado. A política
-- "Permitir gerenciar próprias imagens no crests" (ALL com owner = auth.uid())
-- já cobre o caso correto; basta remover a frouxa.
DROP POLICY IF EXISTS "Permitir upload no crests" ON storage.objects;

-- =============================================================
-- 6. search_path em funções para silenciar avisos
-- =============================================================
ALTER FUNCTION public.accept_transfer(uuid) SET search_path = public;
ALTER FUNCTION public.confirmar_contratacao(uuid) SET search_path = public;
ALTER FUNCTION public.contratar_jogador_direto(uuid, uuid, numeric, numeric, numeric, text, uuid) SET search_path = public;
ALTER FUNCTION public.encerrar_contratos_vencidos() SET search_path = public;
ALTER FUNCTION public.enforce_academy_limit() SET search_path = public;
ALTER FUNCTION public.enforce_squad_limits() SET search_path = public;
ALTER FUNCTION public.fn_recalcular_premiacao() SET search_path = public;
ALTER FUNCTION public.fn_reset_scout_searches_on_season_turn() SET search_path = public;
ALTER FUNCTION public.gerar_propostas_externas() SET search_path = public;
ALTER FUNCTION public.get_tv_rights_value(uuid) SET search_path = public;
ALTER FUNCTION public.processar_aposentadorias() SET search_path = public;
ALTER FUNCTION public.renovar_contrato_jogador(uuid, numeric, integer) SET search_path = public;
ALTER FUNCTION public.scout_academy_player(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.sugerir_salario_jogador(uuid) SET search_path = public;
