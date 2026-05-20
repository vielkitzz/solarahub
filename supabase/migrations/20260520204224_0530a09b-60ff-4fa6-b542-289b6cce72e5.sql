
CREATE TABLE public.kit_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.club_kits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating numeric(2,1) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kit_id, user_id),
  CONSTRAINT kit_ratings_rating_range CHECK (rating >= 0.5 AND rating <= 5 AND (rating * 2) = floor(rating * 2))
);

CREATE INDEX idx_kit_ratings_kit ON public.kit_ratings(kit_id);

ALTER TABLE public.kit_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view kit_ratings" ON public.kit_ratings FOR SELECT USING (true);
CREATE POLICY "Users insert own kit_rating" ON public.kit_ratings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own kit_rating" ON public.kit_ratings FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users delete own kit_rating" ON public.kit_ratings FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.kit_ratings_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_kit_ratings_updated_at
  BEFORE UPDATE ON public.kit_ratings
  FOR EACH ROW EXECUTE FUNCTION public.kit_ratings_touch_updated_at();
