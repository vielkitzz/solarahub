-- =====================================================
-- 1) ENUM para categoria de contrato
-- =====================================================
DO $$ BEGIN
  CREATE TYPE public.contrato_categoria AS ENUM (
    'patrocinio_master',
    'material_esportivo',
    'direitos_tv',
    'socio_torcedor'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- 2) Tabela de empresas
-- =====================================================
CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  logo_url TEXT,
  categoria public.contrato_categoria NOT NULL,
  valor_anual_sugerido NUMERIC NOT NULL DEFAULT 0,
  exigencias TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view empresas"
  ON public.empresas FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage empresas"
  ON public.empresas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 3) Tabela de contratos do clube
-- =====================================================
CREATE TABLE IF NOT EXISTS public.contratos_clube (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  categoria public.contrato_categoria NOT NULL,
  valor_anual NUMERIC NOT NULL DEFAULT 0,
  inicio_temporada INTEGER,
  fim_temporada INTEGER,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_club ON public.contratos_clube(club_id);
CREATE INDEX IF NOT EXISTS idx_contratos_empresa ON public.contratos_clube(empresa_id);

ALTER TABLE public.contratos_clube ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view contratos"
  ON public.contratos_clube FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Owner or admin insert contrato"
  ON public.contratos_clube FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE clubs.id = contratos_clube.club_id AND clubs.owner_id = auth.uid())
  );

CREATE POLICY "Owner or admin update contrato"
  ON public.contratos_clube FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE clubs.id = contratos_clube.club_id AND clubs.owner_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE clubs.id = contratos_clube.club_id AND clubs.owner_id = auth.uid())
  );

CREATE POLICY "Owner or admin delete contrato"
  ON public.contratos_clube FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE clubs.id = contratos_clube.club_id AND clubs.owner_id = auth.uid())
  );

CREATE TRIGGER trg_contratos_updated_at
  BEFORE UPDATE ON public.contratos_clube
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 4) Bucket público para logos de empresas
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('empresas-logos', 'empresas-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read empresas logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'empresas-logos');

CREATE POLICY "Admins upload empresas logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'empresas-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update empresas logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'empresas-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete empresas logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'empresas-logos' AND has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 5) Remover tabela antiga de transações manuais
-- =====================================================
DROP TRIGGER IF EXISTS trg_apply_tx ON public.transactions;
DROP TABLE IF EXISTS public.transactions CASCADE;

-- =====================================================
-- 6) Atualizar virada de temporada para usar contratos
-- =====================================================
CREATE OR REPLACE FUNCTION public.process_season_turnover()
RETURNS TABLE(club_id uuid, club_name text, delta numeric, novo_caixa numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
  receita_base NUMERIC;
  bilheteria NUMERIC;
  manutencao NUMERIC;
  folha NUMERIC;
  contratos NUMERIC;
  premiacao NUMERIC;
  total_delta NUMERIC;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem processar a virada de temporada';
  END IF;

  FOR c IN SELECT * FROM public.clubs WHERE status = 'ativo' LOOP
    receita_base := CASE c.reputacao
      WHEN 'estadual' THEN 4300000
      WHEN 'nacional' THEN 11500000
      WHEN 'continental' THEN 23000000
      WHEN 'mundial' THEN 45000000
      ELSE 0
    END;
    bilheteria := (c.nivel_estadio * 500000) * (c.rate / 3.0);
    manutencao := c.nivel_base * 300000;
    premiacao := premiacao_por_posicao(c.posicao_ultima_temporada);

    SELECT COALESCE(SUM(salario_atual), 0) INTO folha
      FROM public.players WHERE players.club_id = c.id;

    SELECT COALESCE(SUM(valor_anual), 0) INTO contratos
      FROM public.contratos_clube
      WHERE contratos_clube.club_id = c.id AND ativo = true;

    total_delta := receita_base + bilheteria + contratos + premiacao - manutencao - folha;

    UPDATE public.clubs SET budget = budget + total_delta WHERE id = c.id;

    club_id := c.id;
    club_name := c.name;
    delta := total_delta;
    novo_caixa := c.budget + total_delta;
    RETURN NEXT;
  END LOOP;
END;
$function$;