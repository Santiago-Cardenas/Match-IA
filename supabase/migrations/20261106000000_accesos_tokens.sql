-- Acceso a IAs fuera del plan: prueba diaria, acceso mensual o pago por tokens (pagos simulados).

-- Saldo de tokens del usuario (sirve para cualquier IA que no esté en su plan).
ALTER TABLE public.suscripciones ADD COLUMN tokens integer NOT NULL DEFAULT 0 CHECK (tokens >= 0);

-- Acceso mensual comprado para una IA puntual.
CREATE TABLE public.accesos (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  ia text NOT NULL,
  hasta timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ia)
);

ALTER TABLE public.accesos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accesos FROM anon, authenticated;
GRANT SELECT ON public.accesos TO authenticated;
GRANT ALL ON public.accesos TO service_role;
CREATE POLICY "Cada usuario ve sus accesos" ON public.accesos FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Cómo se pagó cada respuesta (plan | mes | prueba | tokens) y cuántos tokens gastó.
ALTER TABLE public.messages ADD COLUMN acceso text;
ALTER TABLE public.messages ADD COLUMN tokens integer;
CREATE INDEX messages_prueba_idx ON public.messages (user_id, acceso, created_at) WHERE acceso = 'prueba';

-- Registro de compras simuladas (para medir intención de pago; nunca datos de tarjeta).
CREATE TABLE public.compras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('plan', 'mes', 'tokens')),
  detalle text NOT NULL,
  precio_cop integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compras FROM anon, authenticated;
GRANT ALL ON public.compras TO service_role;
