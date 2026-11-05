// Configuración de la demo del test de la landing (categorías del test → IA del catálogo).
import { AIS, type AiId } from "./ais";

export type Cat = "Escritura" | "Video" | "Imagen" | "Código" | "Productividad";
export type DemoKind = "texto" | "chat" | "imagen" | "ninguna";

export type ToolConfig = {
  nombre: string;
  descripcion: string;
  porQue: string;
  demo: DemoKind;
  proveedor: "gemini" | null;
  modelo: string | null;
  promptSistema: string;
  placeholder: string;
};

// La aclaración de que las herramientas son simulaciones vive solo en el botón de información (components/disclosure.tsx).

export const MAX_INPUT_CHARS = 500;
/** Prompts máximos por prueba (texto y chat). La imagen sigue siendo de 1 prompt. */
export const MAX_DEMO_PROMPTS = 5;
// Límites en prompts: por correo (2 pruebas completas) y diario global.
export const LIMITS = { textoPorCorreo: MAX_DEMO_PROMPTS * 2, imagenPorCorreo: 1, textoDiario: 1000, imagenDiario: 30 };
export const API_BUSY = "Por el momento se excedió el uso de la API de la demo. Reserva tu cupo y te avisamos apenas esté disponible.";
export const DEMO_UNAVAILABLE = "La demo no está disponible en este momento, reserva tu cupo y te avisamos";

export { identityRule } from "./ais";

// Demo corta del test de la landing: cada categoría del test usa una IA del catálogo (src/lib/ais.ts).
const SHORT = " Responde de forma breve: máximo 150 palabras.";
const MODEL = "gemini-3.1-flash-lite";
const fromAi = (id: AiId, demo: DemoKind, placeholder: string): ToolConfig => {
  const ai = AIS[id];
  return {
    nombre: ai.nombre,
    descripcion: ai.proposito,
    porQue: ai.porQue,
    demo,
    proveedor: "gemini",
    modelo: ai.tipo === "imagen" ? null : MODEL,
    promptSistema: ai.tipo === "imagen" ? ai.prompt : ai.prompt + SHORT,
    placeholder,
  };
};

/** Categoría del test → IA recomendada en la demo. */
export const CAT_TO_AI: Record<Cat, AiId> = { Escritura: "jasper", Video: "synthesia", Productividad: "notion", Imagen: "midjourney", Código: "tabnine" };

export const TOOLS: Record<Cat, ToolConfig> = {
  Escritura: fromAi("jasper", "texto", "Ej: una cafetería de especialidad en Medellín que abre los domingos"),
  Video: fromAi("synthesia", "texto", "Ej: un video de 30 segundos para presentar mi emprendimiento"),
  Productividad: fromAi("notion", "chat", "Ej: ¿cómo priorizo mis tareas de la semana?"),
  Imagen: fromAi("midjourney", "imagen", "Ej: un colibrí de colores sobre una taza de café, estilo acuarela"),
  Código: fromAi("tabnine", "texto", "Ej: ¿cómo invierto un texto en JavaScript?"),
};
