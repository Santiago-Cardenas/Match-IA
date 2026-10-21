// Configuración de las pantallas extra del test (Deseabilidad 2 y 3).
// Cambia aquí precios, opciones o textos sin tocar el diseño.

/** Tasa aproximada para mostrar el gasto en pesos. */
export const USD_TO_COP = 4000;

/** Deseabilidad 2: IAs de pago que el usuario puede marcar como desperdiciadas (precio mensual en USD). */
export const PAID_AIS = [
  { nombre: "ChatGPT Plus", usd: 20 },
  { nombre: "Claude Pro", usd: 20 },
  { nombre: "Gemini (Google AI Pro)", usd: 20 },
  { nombre: "Perplexity Pro", usd: 20 },
  { nombre: "Jasper", usd: 40 },
  { nombre: "Midjourney", usd: 10 },
  { nombre: "Canva Pro", usd: 15 },
  { nombre: "GitHub Copilot", usd: 10 },
  { nombre: "Synthesia", usd: 29 },
  { nombre: "CapCut Pro", usd: 10 },
  { nombre: "Otra IA de pago", usd: 20 },
];

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
    cta: "Probar Pack Explorador",
    recomendado: false,
  },
  {
    id: "Comparador",
    precio: "$19.90 USD",
    puntos: ["Acceso a 5 modelos tope de gama", "Diagnóstico y tabla de resultados", "Pago sin auto-renovación"],
    cta: "Comprar Pack Comparador",
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
