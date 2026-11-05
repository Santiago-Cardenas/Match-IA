-- App con sesión: chats por usuario (estilo ChatGPT).
-- El navegador solo LEE sus chats/mensajes y puede renombrar o borrar sus chats.
-- Todo lo que se escribe (mensajes, respuestas de la IA, límites) pasa por el servidor (service_role).

CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT 'Nuevo chat',
  herramienta text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX chats_user_updated_idx ON public.chats (user_id, updated_at DESC);

CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id uuid NOT NULL REFERENCES public.chats (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'model')),
  -- texto | imagen | aviso (aviso = error o "no disponible", no cuenta para el límite)
  tipo text NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagen', 'aviso')),
  contenido text NOT NULL DEFAULT '',
  imagen_url text,
  herramienta text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX messages_chat_idx ON public.messages (chat_id, created_at);
CREATE INDEX messages_user_created_idx ON public.messages (user_id, created_at);

CREATE TRIGGER update_chats_updated_at
BEFORE UPDATE ON public.chats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chats FROM anon, authenticated;
REVOKE ALL ON public.messages FROM anon, authenticated;
GRANT SELECT, DELETE ON public.chats TO authenticated;
GRANT UPDATE (titulo) ON public.chats TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT ALL ON public.chats TO service_role;
GRANT ALL ON public.messages TO service_role;

CREATE POLICY "Cada usuario ve sus chats" ON public.chats FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Cada usuario renombra sus chats" ON public.chats FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Cada usuario borra sus chats" ON public.chats FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Cada usuario ve sus mensajes" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Imágenes generadas. Bucket público con rutas aleatorias (usuario/uuid.jpg); solo el servidor sube archivos.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;
