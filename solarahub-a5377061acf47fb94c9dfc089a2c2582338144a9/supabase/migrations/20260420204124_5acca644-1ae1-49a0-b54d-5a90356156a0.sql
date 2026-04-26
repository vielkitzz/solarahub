
-- Storage bucket público para escudos de clubes
INSERT INTO storage.buckets (id, name, public)
VALUES ('crests', 'crests', true)
ON CONFLICT (id) DO NOTHING;

-- Qualquer um pode ver
CREATE POLICY "Crests are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'crests');

-- Admins podem fazer upload
CREATE POLICY "Admins upload crests"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'crests' AND public.has_role(auth.uid(), 'admin'));

-- Admins podem atualizar
CREATE POLICY "Admins update crests"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'crests' AND public.has_role(auth.uid(), 'admin'));

-- Admins podem deletar
CREATE POLICY "Admins delete crests"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'crests' AND public.has_role(auth.uid(), 'admin'));
