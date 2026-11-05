# MatchIA (equipo Caotís)

Landing + test (calculadora de gasto en IA + 6 preguntas) + demo de la IA recomendada + packs de prueba + lista de espera,
y la app con sesión (`/entrar`, `/app`): chats estilo ChatGPT con las herramientas simuladas.
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

## App con sesión
- `/entrar`: registro e inicio de sesión con correo y contraseña (Supabase Auth). Para el prototipo conviene desactivar
  *Authentication → Sign In / Providers → Email → Confirm email*, así la cuenta queda activa al instante.
- `/app`: chats guardados en `chats` y `messages` (cada usuario ve solo los suyos). Límites diarios en `src/lib/app-config.ts`.
- Planes (pago **simulado**): al registrarse se elige Explorador (top 3 IAs, 1 prueba diaria de las demás) o Comparador (top 7, 3 pruebas diarias) y se "paga". Las IAs fuera del plan se desbloquean con acceso mensual ($12.000 COP) o tokens (`src/lib/plans.ts`).
  Solo se aprueba la tarjeta de prueba **número `1` y CVV `1`** (cualquier vencimiento y cuotas); cualquier otra se rechaza.
  Los datos de tarjeta nunca salen del navegador. Luego un test corto de match (`src/lib/match-quiz.ts`) elige las IAs del plan.
- IAs disponibles (nombres, propósitos y prompts): `src/lib/ais.ts`. Proyectos = carpetas de chats con nombre sugerido por IA.
- Texto: Gemini. Imágenes: Qwen-Image 2.1 (ver `tools/qwen-image-server/README.md`). La aclaración de que son simulaciones
  está solo en el botón de información (esquina inferior derecha).
- Logos: pon `src/assets/logoNombre.png` (logo con nombre) y `src/assets/logo.png` (isotipo); mientras no existan se dibuja el logo del manual.

## Despliegue en Render
- Build: `npm install && npm run build`
- Start: `node .output/server/index.mjs`
- Variables: ver `.env.example` (las `VITE_*` deben existir antes del build).

## Demo
Texto con Gemini (`gemini-3.1-flash-lite`, gratis). Imagen con `GEMINI_IMAGE_MODEL` (requiere facturación; si no, se muestra el mensaje de demo no disponible). Video: sin demo.
