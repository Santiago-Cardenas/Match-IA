// Planes de Matchia. El pago es simulado (ver components/plans/payment-form.tsx).
export type PlanId = "Explorador" | "Comparador";

export const PLANS: Record<PlanId, { id: PlanId; precio: string; ias: number; resumen: string; puntos: string[]; recomendado: boolean }> = {
  Explorador: {
    id: "Explorador",
    precio: "$9.90 USD",
    ias: 2,
    resumen: "Tus 2 IAs ideales",
    puntos: ["Test de match para encontrar tus 2 IAs ideales", "Acceso a esas 2 IAs en un solo lugar", "Chats y proyectos ilimitados"],
    recomendado: false,
  },
  Comparador: {
    id: "Comparador",
    precio: "$19.90 USD",
    ias: 4,
    resumen: "Tus 4 IAs ideales",
    puntos: ["Test de match para encontrar tus 4 IAs ideales", "Compara 4 IAs de distintos propósitos", "Chats y proyectos ilimitados"],
    recomendado: true,
  },
};

export const PLAN_IDS: PlanId[] = ["Explorador", "Comparador"];
export const isPlan = (v: unknown): v is PlanId => v === "Explorador" || v === "Comparador";

/** Cuotas que se muestran en el formulario de pago. */
export const CUOTAS = [1, 3, 6, 12, 24, 36];
