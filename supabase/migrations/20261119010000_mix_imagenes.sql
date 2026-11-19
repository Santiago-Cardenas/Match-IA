-- Mix con varias imágenes: una por cada publicación o variante del texto (o las que pida el usuario, máximo 4).
-- imagenes = [{ "para": "Opción A", "prompt": "...", "url": "https://..." | null, "error": true? }]
-- El texto se guarda primero y cada imagen se genera después en su propia petición.
ALTER TABLE public.messages ADD COLUMN imagenes jsonb;
