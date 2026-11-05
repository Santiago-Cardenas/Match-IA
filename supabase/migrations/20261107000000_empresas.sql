-- Empresas: el pack lo compra una empresa, que afilia hasta 5 (Explorador) o 10 (Comparador) cuentas.
-- Toda cuenta pertenece a una empresa. Todo se maneja desde las funciones del servidor (service_role).

-- La empresa hace su propio test; sus resultados influyen en el match de cada cuenta.
CREATE TABLE public.empresas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('Explorador', 'Comparador')),
  admin_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  respuestas jsonb,
  ias text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TRIGGER update_empresas_updated_at
BEFORE UPDATE ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cuentas afiliadas. user_id queda vacío hasta que la persona crea su cuenta con ese correo.
-- Un correo solo puede estar en una empresa.
CREATE TABLE public.miembros (
  empresa_id uuid NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre text,
  rol text NOT NULL DEFAULT 'miembro' CHECK (rol IN ('admin', 'miembro')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, email)
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.empresas FROM anon, authenticated;
REVOKE ALL ON public.miembros FROM anon, authenticated;
GRANT ALL ON public.empresas TO service_role;
GRANT ALL ON public.miembros TO service_role;

-- Las cuentas que ya tenían plan quedan como administradoras de su propia empresa.
WITH nuevas AS (
  INSERT INTO public.empresas (nombre, plan, admin_id)
  SELECT 'Empresa de ' || coalesce(nullif(u.raw_user_meta_data ->> 'nombre', ''), split_part(u.email, '@', 1)), s.plan, s.user_id
  FROM public.suscripciones s
  JOIN auth.users u ON u.id = s.user_id
  RETURNING id, admin_id
)
INSERT INTO public.miembros (empresa_id, email, user_id, nombre, rol)
SELECT n.id, lower(u.email), n.admin_id, nullif(u.raw_user_meta_data ->> 'nombre', ''), 'admin'
FROM nuevas n
JOIN auth.users u ON u.id = n.admin_id;
