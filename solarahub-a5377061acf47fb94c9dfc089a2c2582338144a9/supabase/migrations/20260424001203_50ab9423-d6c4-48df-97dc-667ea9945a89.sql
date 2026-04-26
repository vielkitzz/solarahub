-- Restringe SELECT em storage.objects: nenhuma policy de SELECT pública
-- significa que listagem direta da API é bloqueada, porém URLs públicas
-- de buckets marcados como public continuam servindo os arquivos.

DROP POLICY IF EXISTS "Public read empresas logos" ON storage.objects;

-- Crests: a policy original também é over-broad. Removemos se existir.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND (qual LIKE '%bucket_id = ''crests''%' OR qual LIKE '%bucket_id = ''empresas-logos''%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;