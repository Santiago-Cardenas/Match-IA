# MatchIA (equipo Caotís)

Landing + test de 6 preguntas + lista de espera + demo corta de la IA recomendada.
Stack: TanStack Start (React 19), Tailwind 4, Supabase, Gemini API.

## Local
```
npm install
cp .env.example .env   # llena tus claves
npm run dev
```

## Base de datos
Crea un proyecto en supabase.com y ejecuta en el SQL Editor, en orden, los archivos de `supabase/migrations/`.

## Despliegue en Render
- Build: `npm install && npm run build`
- Start: `node .output/server/index.mjs`
- Variables: ver `.env.example` (las `VITE_*` deben existir antes del build).

## Demo
Texto con Gemini (`gemini-3.1-flash-lite`, gratis). Imagen con `GEMINI_IMAGE_MODEL` (requiere facturación; si no, se muestra el mensaje de demo no disponible). Video: sin demo.
