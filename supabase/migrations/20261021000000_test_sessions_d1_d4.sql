-- Deseabilidad 1 (test-drive) y 4 (diagnóstico): campos nuevos de test_sessions.
ALTER TABLE public.test_sessions
  ADD COLUMN clic_probar boolean NOT NULL DEFAULT false,
  ADD COLUMN confianza_antes smallint CHECK (confianza_antes BETWEEN 1 AND 5),
  ADD COLUMN confianza_despues smallint CHECK (confianza_despues BETWEEN 1 AND 5),
  ADD COLUMN prueba_decisiva boolean,
  ADD COLUMN clic_suscribirme boolean NOT NULL DEFAULT false;

-- Se agregan al final de la vista (CREATE OR REPLACE solo permite columnas nuevas al final).
CREATE OR REPLACE VIEW public.test_resultados WITH (security_invoker = true) AS
SELECT
  id,
  created_at AS fecha,
  paso,
  completado,
  array_to_string(ias_pagadas, ', ') AS ias_pagadas,
  cardinality(ias_pagadas) AS cantidad_ias,
  meses_sin_uso,
  gasto_usd,
  gasto_cop,
  clic_continuar,
  respuestas ->> 'uso_principal' AS uso_principal,
  respuestas ->> 'frecuencia' AS frecuencia,
  respuestas ->> 'presupuesto' AS presupuesto,
  respuestas ->> 'ecosistema' AS ecosistema,
  respuestas ->> 'imagen_video' AS imagen_video,
  respuestas ->> 'simplicidad' AS simplicidad,
  categoria_ganadora,
  herramienta_recomendada,
  match_pct,
  nombre,
  email,
  whatsapp,
  demo_estado,
  demo_prompts,
  pack_elegido,
  motivo_sin_pack,
  utm_source,
  utm_medium,
  utm_campaign,
  referrer,
  demo_conversacion,
  clic_probar,
  confianza_antes,
  confianza_despues,
  prueba_decisiva,
  clic_suscribirme
FROM public.test_sessions;

GRANT SELECT ON public.test_resultados TO service_role;
