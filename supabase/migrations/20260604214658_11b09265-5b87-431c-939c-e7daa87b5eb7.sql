
-- =============================================================
-- 1. LIMPEZA PONTUAL
-- =============================================================

-- 1.1 Remove <img src="data:image..."> das wikis (preserva o resto)
UPDATE public.clubs
SET wiki = jsonb_set(
  wiki,
  '{content}',
  to_jsonb(
    regexp_replace(
      COALESCE(wiki->>'content',''),
      '<img[^>]*src="data:image[^"]*"[^>]*/?>',
      '',
      'g'
    )
  )
)
WHERE wiki::text LIKE '%data:image%';

-- 1.2 Truncar logs do pg_net (resposta HTTP) e fila
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='net' AND table_name='_http_response') THEN
    EXECUTE 'TRUNCATE TABLE net._http_response';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='net' AND table_name='http_request_queue') THEN
    EXECUTE 'DELETE FROM net.http_request_queue';
  END IF;
END$$;

-- 1.3 Webhook hooks antigos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='supabase_functions' AND table_name='hooks') THEN
    EXECUTE 'DELETE FROM supabase_functions.hooks WHERE created_at < now() - interval ''7 days''';
  END IF;
END$$;

-- 1.4 Notificações lidas antigas
DELETE FROM public.notifications WHERE lida = true AND created_at < now() - interval '30 days';

-- 1.5 Propostas externas finalizadas antigas
DELETE FROM public.external_proposals
WHERE status <> 'pendente' AND updated_at < now() - interval '60 days';

-- 1.6 Transferências finalizadas antigas
DELETE FROM public.transferencias
WHERE status <> 'pendente' AND updated_at < now() - interval '180 days';

-- =============================================================
-- 2. PREVENÇÃO: trigger barra base64 em clubs.wiki
-- =============================================================
CREATE OR REPLACE FUNCTION public.block_base64_in_wiki()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.wiki IS NOT NULL AND position('data:image' in NEW.wiki::text) > 0 THEN
    RAISE EXCEPTION 'Imagens coladas direto (base64) não são permitidas na wiki. Use o botão de upload de imagem para enviá-las ao armazenamento.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_base64_in_wiki ON public.clubs;
CREATE TRIGGER trg_block_base64_in_wiki
BEFORE INSERT OR UPDATE OF wiki ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.block_base64_in_wiki();

-- =============================================================
-- 3. ROTINA SEMANAL DE MANUTENÇÃO
-- =============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.run_storage_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- pg_net response logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='net' AND table_name='_http_response') THEN
    EXECUTE 'DELETE FROM net._http_response WHERE created < now() - interval ''2 days''';
  END IF;

  -- Webhook hooks
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='supabase_functions' AND table_name='hooks') THEN
    EXECUTE 'DELETE FROM supabase_functions.hooks WHERE created_at < now() - interval ''7 days''';
  END IF;

  -- Notificações lidas
  DELETE FROM public.notifications
  WHERE lida = true AND created_at < now() - interval '30 days';

  -- Propostas externas finalizadas
  DELETE FROM public.external_proposals
  WHERE status <> 'pendente' AND updated_at < now() - interval '60 days';

  -- Transferências finalizadas
  DELETE FROM public.transferencias
  WHERE status <> 'pendente' AND updated_at < now() - interval '180 days';
END;
$$;

-- Agendamento: domingos 03:00
DO $$
BEGIN
  PERFORM cron.unschedule('storage_maintenance_weekly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='storage_maintenance_weekly');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'storage_maintenance_weekly',
  '0 3 * * 0',
  $$SELECT public.run_storage_maintenance();$$
);
