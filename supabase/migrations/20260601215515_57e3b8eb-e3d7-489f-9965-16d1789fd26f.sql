CREATE OR REPLACE FUNCTION public.encerrar_contratos_vencidos()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  temporada_corrente int;
  total int;
BEGIN
  SELECT (value->>'ano')::int INTO temporada_corrente
  FROM settings WHERE key = 'temporada_atual' LIMIT 1;

  -- Um contrato "até 2025" deve permanecer ativo durante toda a temporada 2025
  -- e só ser encerrado quando a temporada corrente já avançou para 2026.
  UPDATE contratos_clube
  SET ativo = false
  WHERE ativo = true
    AND fim_temporada IS NOT NULL
    AND fim_temporada < temporada_corrente;

  GET DIAGNOSTICS total = ROW_COUNT;
  RETURN total;
END;
$function$;