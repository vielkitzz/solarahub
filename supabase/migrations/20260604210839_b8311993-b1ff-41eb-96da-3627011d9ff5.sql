CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.player_retirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID,
  player_name TEXT NOT NULL,
  club_id UUID,
  club_name TEXT,
  position TEXT,
  nationality TEXT,
  age INTEGER,
  habilidade_final INTEGER,
  temporada INTEGER NOT NULL,
  motivo TEXT NOT NULL DEFAULT 'idade',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.player_retirements TO anon;
GRANT SELECT ON public.player_retirements TO authenticated;
GRANT ALL ON public.player_retirements TO service_role;

ALTER TABLE public.player_retirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view player_retirements"
  ON public.player_retirements FOR SELECT USING (true);

CREATE POLICY "Admins manage player_retirements"
  ON public.player_retirements FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_player_retirements_player_id ON public.player_retirements(player_id);
CREATE INDEX idx_player_retirements_club_id ON public.player_retirements(club_id);
CREATE INDEX idx_player_retirements_temporada ON public.player_retirements(temporada);

CREATE TRIGGER trg_player_retirements_updated_at
  BEFORE UPDATE ON public.player_retirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();