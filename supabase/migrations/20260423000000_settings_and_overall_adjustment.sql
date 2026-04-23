-- 1. Tabela de configurações globais
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ler
CREATE POLICY "Public view settings" ON public.settings FOR SELECT USING (true);

-- Política: Apenas admin pode editar
CREATE POLICY "Admin manage settings" ON public.settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Inserir temporada inicial
INSERT INTO public.settings (key, value)
VALUES ('current_season', '"Temporada 2020"')
ON CONFLICT (key) DO NOTHING;

-- 2. Ajustar escala de Overall para 45-99
-- Se o overall for menor que 45, vamos remapear proporcionalmente ou definir um piso
-- O pedido diz: "Rating altere para Overall de 45 a 99"
-- Como o backfill anterior fez rating * 20 (1-5 -> 20-100), vamos ajustar para o novo piso.
UPDATE public.players
SET overall = GREATEST(45, LEAST(99, overall))
WHERE overall IS NOT NULL;

-- 3. Atualizar a função de cálculo para refletir a nova escala se necessário
-- Atualmente: base := NEW.overall * 100000;
-- Com 45-99, o valor mínimo será 4.5M e o máximo 9.9M. 
-- Isso parece razoável dentro da economia do jogo.
