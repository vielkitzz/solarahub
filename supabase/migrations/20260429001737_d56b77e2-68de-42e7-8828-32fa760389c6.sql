
CREATE TABLE IF NOT EXISTS public.resultados_temporada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  temporada INTEGER NOT NULL,
  torneio TEXT NOT NULL,
  fase TEXT,
  clube_nome TEXT NOT NULL,
  clube_id UUID,
  posicao INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT resultados_temporada_unique UNIQUE (temporada, torneio, clube_nome)
);

ALTER TABLE public.resultados_temporada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view resultados_temporada" ON public.resultados_temporada
  FOR SELECT USING (true);

CREATE POLICY "Admins manage resultados_temporada" ON public.resultados_temporada
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_resultados_temporada_updated_at
  BEFORE UPDATE ON public.resultados_temporada
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.premiacoes_torneio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneio TEXT NOT NULL,
  fase TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT premiacoes_torneio_unique UNIQUE (torneio, fase)
);

ALTER TABLE public.premiacoes_torneio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view premiacoes_torneio" ON public.premiacoes_torneio
  FOR SELECT USING (true);

CREATE POLICY "Admins manage premiacoes_torneio" ON public.premiacoes_torneio
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_premiacoes_torneio_updated_at
  BEFORE UPDATE ON public.premiacoes_torneio
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
