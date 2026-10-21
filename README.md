# MatchIA (equipo Caotís)

Landing + test (calculadora de gasto en IA + 6 preguntas) + demo de la IA recomendada (máx. 5 prompts) + packs de prueba + lista de espera.
Stack: TanStack Start (React 19), Tailwind 4, Supabase, Gemini API.

## Local
```
npm install
cp .env.example .env   # llena tus claves
npm run dev
```

## Base de datos
Crea un proyecto en supabase.com y ejecuta en el SQL Editor, en orden, los archivos de `supabase/migrations/`.

## Resultados del test
Cada persona que abre el test genera una fila en `test_sessions`, que se actualiza en cada paso (quien abandona queda con el último `paso` alcanzado).
- **Panel:** entra a `/resultados` con la clave `RESULTS_KEY`: métricas de Deseabilidad 2 y 3, embudo y botón **Descargar CSV** (abre directo en Excel o Google Sheets).
- **Supabase:** la vista `test_resultados` tiene una columna por pregunta; en el SQL Editor corre `select * from test_resultados` y exporta a CSV.

## Despliegue en Render
- Build: `npm install && npm run build`
- Start: `node .output/server/index.mjs`
- Variables: ver `.env.example` (las `VITE_*` deben existir antes del build).

## Demo
Texto con Gemini (`gemini-3.1-flash-lite`, gratis). Imagen con `GEMINI_IMAGE_MODEL` (requiere facturación; si no, se muestra el mensaje de demo no disponible). Video: sin demo.
