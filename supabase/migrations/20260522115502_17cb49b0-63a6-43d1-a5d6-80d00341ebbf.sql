
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS secondary_position text;

CREATE TABLE IF NOT EXISTS public.player_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  target_position text NOT NULL,
  seasons_total integer NOT NULL,
  seasons_completed integer NOT NULL DEFAULT 0,
  starting_season integer NOT NULL,
  penalty_initial integer NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS player_trainings_one_active_per_player
  ON public.player_trainings (player_id) WHERE active;

CREATE INDEX IF NOT EXISTS player_trainings_club_idx ON public.player_trainings (club_id);

ALTER TABLE public.player_trainings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view player_trainings" ON public.player_trainings;
CREATE POLICY "Public view player_trainings"
  ON public.player_trainings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner or admin manage player_trainings" ON public.player_trainings;
CREATE POLICY "Owner or admin manage player_trainings"
  ON public.player_trainings FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = player_trainings.club_id AND c.owner_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = player_trainings.club_id AND c.owner_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.tg_player_trainings_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_player_trainings_updated_at ON public.player_trainings;
CREATE TRIGGER update_player_trainings_updated_at
  BEFORE UPDATE ON public.player_trainings
  FOR EACH ROW EXECUTE FUNCTION public.tg_player_trainings_set_updated_at();
