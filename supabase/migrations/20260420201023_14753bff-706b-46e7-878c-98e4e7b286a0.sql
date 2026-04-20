-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabela user_roles (separada por segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_id TEXT,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Tabela admins fixos por Discord ID (resolvidos em login)
CREATE TABLE public.admin_discord_ids (
  discord_id TEXT PRIMARY KEY,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.admin_discord_ids (discord_id, note) VALUES
  ('858559322370998343', 'Admin fundador'),
  ('779433269951201301', 'Admin fundador'),
  ('825465500892004404', 'Admin fundador');

-- Função security definer para checar role (evita recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para pegar discord_id do usuário atual via JWT metadata
CREATE OR REPLACE FUNCTION public.current_discord_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'provider_id'),
    (auth.jwt() -> 'user_metadata' ->> 'sub')
  )
$$;

-- Trigger: ao criar user, promove a admin se discord_id estiver na lista
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d_id TEXT;
BEGIN
  d_id := COALESCE(
    NEW.raw_user_meta_data ->> 'provider_id',
    NEW.raw_user_meta_data ->> 'sub'
  );

  -- Sempre cria role 'user'
  INSERT INTO public.user_roles (user_id, discord_id, role)
  VALUES (NEW.id, d_id, 'user')
  ON CONFLICT DO NOTHING;

  -- Se discord_id está na lista de admins, adiciona role admin
  IF d_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.admin_discord_ids WHERE discord_id = d_id) THEN
    INSERT INTO public.user_roles (user_id, discord_id, role)
    VALUES (NEW.id, d_id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tabela Clubs
CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  crest_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_discord_id TEXT,
  budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  stadium_capacity INTEGER NOT NULL DEFAULT 0,
  stadium_name TEXT,
  city TEXT,
  founded_year INTEGER,
  primary_color TEXT,
  wiki JSONB NOT NULL DEFAULT '{"content":""}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela Players
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  market_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  age INTEGER,
  nationality TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount NUMERIC(14,2) NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_clubs_updated BEFORE UPDATE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_players_updated BEFORE UPDATE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: ao inserir transaction, atualiza budget do clube
CREATE OR REPLACE FUNCTION public.apply_transaction_to_budget()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'income' THEN
    UPDATE public.clubs SET budget = budget + NEW.amount WHERE id = NEW.club_id;
  ELSE
    UPDATE public.clubs SET budget = budget - NEW.amount WHERE id = NEW.club_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_apply_transaction
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_transaction_to_budget();

-- RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_discord_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- user_roles: usuário vê só os próprios; admin vê tudo
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- admin_discord_ids: só admins
CREATE POLICY "Admins read admin list" ON public.admin_discord_ids
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage admin list" ON public.admin_discord_ids
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- clubs: leitura pública; update pelo dono ou admin; insert/delete só admin
CREATE POLICY "Public can view clubs" ON public.clubs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins create clubs" ON public.clubs
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner or admin update club" ON public.clubs
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete clubs" ON public.clubs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- players: leitura pública; admin gerencia
CREATE POLICY "Public view players" ON public.players
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage players" ON public.players
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- transactions: leitura pública; insert por dono do clube ou admin
CREATE POLICY "Public view transactions" ON public.transactions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owner or admin add transactions" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid())
  );
CREATE POLICY "Admins delete transactions" ON public.transactions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_players_club ON public.players(club_id);
CREATE INDEX idx_transactions_club ON public.transactions(club_id);
CREATE INDEX idx_clubs_owner ON public.clubs(owner_id);