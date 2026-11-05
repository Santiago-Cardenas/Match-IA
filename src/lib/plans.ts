// Planes de Matchia y precios para IAs fuera del plan. Todos los pagos son simulados (components/plans/payment-form.tsx).
import { USD_TO_COP } from "./test-config";

export type PlanId = "Explorador" | "Comparador";

export const PLANS: Record<
  PlanId,
  { id: PlanId; precio: string; ias: number; pruebasDiarias: number; resumen: string; puntos: string[]; recomendado: boolean }
> = {
  Explorador: {
    id: "Explorador",
    precio: "$9.90 USD",
    ias: 3,
    pruebasDiarias: 1,
    resumen: "Tus 3 IAs ideales",
    puntos: ["Test de match para encontrar tus 3 IAs ideales", "1 prompt de prueba al día en cada IA que no esté en tu plan", "Chats y proyectos ilimitados"],
    recomendado: false,
  },
  Comparador: {
    id: "Comparador",
    precio: "$19.90 USD",
    ias: 7,
    pruebasDiarias: 3,
    resumen: "Tus 7 IAs ideales",
    puntos: ["Test de match para encontrar tus 7 IAs ideales", "3 prompts de prueba al día en cada IA que no esté en tu plan", "Chats y proyectos ilimitados"],
    recomendado: true,
  },
};

export const PLAN_IDS: PlanId[] = ["Explorador", "Comparador"];
export const isPlan = (v: unknown): v is PlanId => v === "Explorador" || v === "Comparador";

/** Cuotas que se muestran en el formulario de pago. */
export const CUOTAS = [1, 3, 6, 12, 24, 36];

export const formatCOP = (n: number) => `$${Math.round(n).toLocaleString("es-CO")} COP`;

/** Acceso mensual completo a una IA que no está en el plan (US$3, mostrado en pesos). */
export const MES_USD = 3;
export const MES_COP = MES_USD * USD_TO_COP;
export const MES_DIAS = 30;

/** Pago por uso: recargas de tokens que sirven para cualquier IA fuera del plan. */
export const TOKEN_PACKS = [
  { id: "t30k", tokens: 30_000, cop: 3_000 },
  { id: "t150k", tokens: 150_000, cop: 12_000 },
  { id: "t500k", tokens: 500_000, cop: 35_000 },
] as const;
export type TokenPackId = (typeof TOKEN_PACKS)[number]["id"];

/** Tokens que descuenta cada imagen generada (las respuestas de texto descuentan los tokens reales). */
export const IMAGE_TOKENS = 5_000;
export const formatTokens = (n: number) => n.toLocaleString("es-CO");
