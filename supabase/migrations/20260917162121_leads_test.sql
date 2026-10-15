CREATE TABLE public.leads_test (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  respuestas jsonb NOT NULL DEFAULT '{}'::jsonb,
  proveedor_ganador text NOT NULL,
  puntaje jsonb NOT NULL DEFAULT '{}'::jsonb,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.leads_test TO anon, authenticated;
GRANT ALL ON public.leads_test TO service_role;

ALTER TABLE public.leads_test ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a test lead"
ON public.leads_test FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_leads_test_updated_at
BEFORE UPDATE ON public.leads_test
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
