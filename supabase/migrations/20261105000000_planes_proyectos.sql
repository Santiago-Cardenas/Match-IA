-- Planes (pago simulado) y proyectos (carpetas de chats).

-- Suscripción de cada usuario: plan elegido y las IAs a las que tiene acceso (top 2 o top 4 del test de match).
-- Nunca se guardan datos de tarjeta: el pago es simulado y se valida solo en el navegador.
CREATE TABLE public.suscripciones (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('Explorador', 'Comparador')),
  ias text[] NOT NULL DEFAULT '{}',
  respuestas jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TRIGGER update_suscripciones_updated_at
BEFORE UPDATE ON public.suscripciones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suscripciones FROM anon, authenticated;
GRANT SELECT ON public.suscripciones TO authenticated;
GRANT ALL ON public.suscripciones TO service_role;
CREATE POLICY "Cada usuario ve su suscripción" ON public.suscripciones FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Proyectos: agrupan chats. El servidor los crea (pone el nombre con IA); el usuario puede renombrarlos o borrarlos.
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX projects_user_idx ON public.projects (user_id, created_at DESC);

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.projects FROM anon, authenticated;
GRANT SELECT, DELETE ON public.projects TO authenticated;
GRANT UPDATE (nombre) ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
CREATE POLICY "Cada usuario ve sus proyectos" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Cada usuario renombra sus proyectos" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Cada usuario borra sus proyectos" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Cada chat puede pertenecer a un proyecto (al borrar el proyecto, los chats quedan sueltos).
ALTER TABLE public.chats ADD COLUMN project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL;
CREATE INDEX chats_project_idx ON public.chats (project_id);

-- El usuario puede mover sus chats entre SUS proyectos (o sacarlos de uno).
GRANT UPDATE (titulo, project_id) ON public.chats TO authenticated;
DROP POLICY "Cada usuario renombra sus chats" ON public.chats;
CREATE POLICY "Cada usuario edita sus chats" ON public.chats FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (project_id IS NULL OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  );
