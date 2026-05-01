
-- Tabela de empréstimos
CREATE TABLE public.loans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  valor_total NUMERIC NOT NULL,
  valor_parcela NUMERIC NOT NULL,
  installments_total INTEGER NOT NULL,
  installments_paid INTEGER NOT NULL DEFAULT 0,
  juros_pct NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view loans"
  ON public.loans FOR SELECT
  USING (true);

CREATE POLICY "Owner or admin manage loans"
  ON public.loans FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (SELECT 1 FROM public.clubs WHERE clubs.id = loans.club_id AND clubs.owner_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (SELECT 1 FROM public.clubs WHERE clubs.id = loans.club_id AND clubs.owner_id = auth.uid())
  );

CREATE TRIGGER loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_loans_club ON public.loans(club_id);

-- Coluna para acompanhar evolução do jogador (snapshot da habilidade anterior)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS habilidade_anterior INTEGER;
