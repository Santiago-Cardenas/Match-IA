-- Una fila por persona que abre el test. Se actualiza (upsert por id) a medida que avanza,
-- así también quedan registrados quienes abandonan a mitad de camino (columna "paso").
CREATE TABLE public.test_sessions (
  id uuid NOT NULL PRIMARY KEY,
  paso text NOT NULL DEFAULT 'gasto',
  completado boolean NOT NULL DEFAULT false,
  -- Deseabilidad 2: calculadora de gasto en IA
  ias_pagadas text[] NOT NULL DEFAULT '{}',
  meses_sin_uso integer,
  gasto_usd numeric(10, 2) NOT NULL DEFAULT 0,
  gasto_cop numeric(14, 0) NOT NULL DEFAULT 0,
  clic_continuar boolean NOT NULL DEFAULT false,
  -- Test de perfil
  respuestas jsonb NOT NULL DEFAULT '{}'::jsonb,
  categoria_ganadora text,
  herramienta_recomendada text,
  match_pct integer,
  puntaje jsonb,
  -- Datos de contacto
  nombre text,
  email text,
  whatsapp text,
  -- Demo
  demo_estado text,
  demo_prompts integer NOT NULL DEFAULT 0,
  demo_conversacion jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Deseabilidad 3: packs de prueba
  pack_elegido text,
  motivo_sin_pack text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX test_sessions_created_idx ON public.test_sessions (created_at DESC);

-- Solo el servidor (service_role) lee/escribe; el navegador pasa por una server function.
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.test_sessions FROM anon, authenticated;
GRANT ALL ON public.test_sessions TO service_role;

CREATE TRIGGER update_test_sessions_updated_at
BEFORE UPDATE ON public.test_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vista "plana" para exportar a CSV / Excel / Google Sheets (una columna por pregunta).
CREATE VIEW public.test_resultados WITH (security_invoker = true) AS
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
  demo_conversacion
FROM public.test_sessions;

REVOKE ALL ON public.test_resultados FROM anon, authenticated;
GRANT SELECT ON public.test_resultados TO service_role;
