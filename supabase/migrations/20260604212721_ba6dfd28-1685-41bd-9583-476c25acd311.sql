ALTER TABLE public.players ADD COLUMN IF NOT EXISTS retirement_season integer;
ALTER TABLE public.academy_players ADD COLUMN IF NOT EXISTS retirement_season integer;
ALTER TABLE public.foreign_market_players ADD COLUMN IF NOT EXISTS retirement_season integer;
ALTER TABLE public.free_agents ADD COLUMN IF NOT EXISTS retirement_season integer;