UPDATE public.settings
SET value = jsonb_set(
  value,
  '{receita_base}',
  '{"estadual": 3010000, "nacional": 8050000, "continental": 16100000, "mundial": 31500000}'::jsonb,
  true
)
WHERE key = 'economia_params';