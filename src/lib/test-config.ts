// Configuración de las pantallas extra del test (Deseabilidad 2 y 3).
// Cambia aquí precios, opciones o textos sin tocar el diseño.

/** Tasa aproximada para mostrar el gasto en pesos. */
export const USD_TO_COP = 4000;

/**
 * Deseabilidad 2: IAs de pago que el usuario puede marcar como desperdiciadas.
 * El precio mensual (USD) NO se muestra al usuario; solo se usa para calcular el gasto.
 */
export const PAID_AIS = [
  { nombre: "ChatGPT", usd: 20 },
  { nombre: "Claude", usd: 20 },
  { nombre: "Gemini", usd: 20 },
  { nombre: "Jasper", usd: 40 },
  { nombre: "Midjourney", usd: 10 },
  { nombre: "Otra", usd: 20 },
];

/** Deseabilidad 4: parámetros técnicos traducidos a necesidades del día a día, por categoría. */
export const PARAMS: Record<string, { titulo: string; tecnico: string }[]> = {
  Escritura: [
    { titulo: "Contenido persuasivo sin hoja en blanco", tecnico: "Plantillas de copywriting" },
    { titulo: "Mantiene tu estilo en cada texto", tecnico: "Voz de marca configurable" },
    { titulo: "Respuestas en segundos", tecnico: "Baja latencia de generación" },
  ],
  Video: [
    { titulo: "Videos sin cámara ni estudio", tecnico: "Avatares y voz sintética" },
    { titulo: "Tus piezas en varios idiomas", tecnico: "Doblaje y subtítulos automáticos" },
    { titulo: "Editar es tan fácil como escribir", tecnico: "Edición por texto (text-to-video)" },
  ],
  Imagen: [
    { titulo: "Tus ideas convertidas en imágenes", tecnico: "Generación text-to-image" },
    { titulo: "Estilos visuales a tu gusto", tecnico: "Control de estilo y parámetros" },
    { titulo: "Resultados listos para compartir", tecnico: "Alta resolución y upscaling" },
  ],
  Código: [
    { titulo: "Código y explicaciones al instante", tecnico: "Generación y autocompletado de código" },
    { titulo: "Entiende proyectos largos", tecnico: "Ventana de contexto extensa" },
    { titulo: "Menos errores en lo que escribes", tecnico: "Benchmarks HumanEval" },
  ],
  Productividad: [
    { titulo: "Responde sobre tus propios documentos", tecnico: "Entrenado con tu contenido (RAG)" },
    { titulo: "Organiza tareas y procesos", tecnico: "Automatización de flujos" },
    { titulo: "Respuestas ultrarrápidas", tecnico: "Baja latencia TTFT (time-to-first-token)" },
  ],
};

export const MONTH_OPTIONS = [
  { label: "Menos de 1 mes", meses: 1 },
  { label: "1 a 2 meses", meses: 2 },
  { label: "3 a 6 meses", meses: 4 },
  { label: "Más de 6 meses", meses: 8 },
];

/** Deseabilidad 3: packs de prueba (puerta falsa, aún no se cobra). */
export const PACKS = [
  {
    id: "Explorador",
    precio: "$9.90 USD",
    puntos: ["48 horas de acceso a 2 herramientas", "Entorno de pruebas seguro", "Ideal para tareas rápidas y directas"],
    cta: "Me interesa el Pack Explorador",
    recomendado: false,
  },
  {
    id: "Comparador",
    precio: "$19.90 USD",
    puntos: ["Acceso a 5 modelos tope de gama", "Diagnóstico y tabla de resultados", "Pago sin auto-renovación"],
    cta: "Me interesa el Pack Comparador",
    recomendado: true,
  },
] as const;

export type PackId = (typeof PACKS)[number]["id"];

export const NO_PACK_REASONS = [
  "Me parece caro",
  "Prefiero las pruebas gratis de cada herramienta",
  "No necesito probar más IAs",
  "Otro motivo",
];

export const formatUsd = (n: number) => `$${n.toLocaleString("es-CO")}`;
export const formatCop = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;
