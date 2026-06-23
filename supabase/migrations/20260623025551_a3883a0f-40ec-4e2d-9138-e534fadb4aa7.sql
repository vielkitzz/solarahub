
CREATE TABLE public.club_crests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  descricao text,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_club_crests_club ON public.club_crests(club_id, ano DESC);

GRANT SELECT ON public.club_crests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_crests TO authenticated;
GRANT ALL ON public.club_crests TO service_role;

ALTER TABLE public.club_crests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view club_crests" ON public.club_crests FOR SELECT USING (true);

CREATE POLICY "Owner or admin manage club_crests" ON public.club_crests FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.set_updated_at_club_crests()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_club_crests_updated_at BEFORE UPDATE ON public.club_crests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_club_crests();
