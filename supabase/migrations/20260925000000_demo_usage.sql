CREATE TABLE public.demo_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  kind text NOT NULL,
  categoria text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX demo_usage_kind_created_idx ON public.demo_usage (kind, created_at);
CREATE INDEX demo_usage_email_idx ON public.demo_usage (lower(email));

-- Solo el servidor (service_role) puede leer/escribir; sin políticas para anon.
ALTER TABLE public.demo_usage ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.demo_usage TO service_role;

-- El servidor necesita leer leads_test para validar que el correo ya se registró.
-- service_role ya tiene GRANT ALL en leads_test.
