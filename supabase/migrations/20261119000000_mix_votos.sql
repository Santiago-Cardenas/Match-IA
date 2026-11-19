-- Mix (dos IAs en un solo prompt), votos de las respuestas para ajustar "Tu match" y memoria global.

-- Respuesta Mix: texto de una IA de texto + imagen de una IA de imagen en el mismo mensaje.
-- herramienta = "jasper+midjourney"; acceso = cómo se pagó cada una, en el mismo orden ("plan+prueba").
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_tipo_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_tipo_check CHECK (tipo IN ('texto', 'imagen', 'aviso', 'mix'));

-- Prompt que la IA de texto escribió para la imagen acompañante (interno: no se muestra, sirve de contexto).
ALTER TABLE public.messages ADD COLUMN imagen_prompt text;

-- Pulgar arriba (1) o abajo (-1) del usuario sobre una respuesta. Lo escribe el servidor.
ALTER TABLE public.messages ADD COLUMN voto smallint CHECK (voto IN (-1, 1));
CREATE INDEX messages_voto_idx ON public.messages (user_id) WHERE voto IS NOT NULL;

-- Memoria global: lo que todas las IAs saben sin que se lo repitan en cada chat.
-- descripcion = qué hace la empresa (la edita la cuenta administradora); memoria = nota personal de cada cuenta.
ALTER TABLE public.empresas ADD COLUMN descripcion text CHECK (char_length(descripcion) <= 1000);
ALTER TABLE public.suscripciones ADD COLUMN memoria text CHECK (char_length(memoria) <= 1000);
