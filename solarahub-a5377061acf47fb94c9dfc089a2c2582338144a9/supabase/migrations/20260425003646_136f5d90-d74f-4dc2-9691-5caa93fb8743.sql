-- Remove trigger antes do rename para não disparar com a função antiga
DROP TRIGGER IF EXISTS trg_calc_player_value ON public.players;

ALTER TABLE public.players RENAME COLUMN overall TO habilidade;
UPDATE public.players SET habilidade = LEAST(99, GREATEST(45, COALESCE(habilidade, 45)));
ALTER TABLE public.players ALTER COLUMN habilidade SET DEFAULT 45;
ALTER TABLE public.players ADD CONSTRAINT players_habilidade_range CHECK (habilidade IS NULL OR (habilidade >= 45 AND habilidade <= 99));

CREATE OR REPLACE FUNCTION public.calc_player_value()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  base NUMERIC;
  mult NUMERIC := 1.0;
BEGIN
  IF NEW.habilidade IS NULL THEN
    RETURN NEW;
  END IF;
  base := NEW.habilidade * 100000;
  IF NEW.age IS NOT NULL THEN
    IF NEW.age <= 22 THEN mult := 1.5;
    ELSIF NEW.age >= 31 THEN mult := 0.7;
    END IF;
  END IF;
  NEW.valor_base_calculado := base * mult;
  NEW.salario_atual := NEW.valor_base_calculado * 0.10;
  NEW.market_value := NEW.valor_base_calculado;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_calc_player_value
BEFORE INSERT OR UPDATE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.calc_player_value();