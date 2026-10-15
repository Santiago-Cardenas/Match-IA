CREATE TABLE public.waitlist_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  pack TEXT NOT NULL,
  main_use TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT INSERT ON public.waitlist_signups TO anon, authenticated;
GRANT ALL ON public.waitlist_signups TO service_role;
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join the waitlist" ON public.waitlist_signups FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.cta_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  pack TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT INSERT ON public.cta_clicks TO anon, authenticated;
GRANT ALL ON public.cta_clicks TO service_role;
ALTER TABLE public.cta_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log a cta click" ON public.cta_clicks FOR INSERT TO anon, authenticated WITH CHECK (true);
