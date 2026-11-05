// Test de match de la app (después de "comprar" un plan): 5 preguntas que puntúan cada IA del catálogo.
// Distinto al test de validación de la landing: aquí solo se busca el top de IAs para el plan.
import { AI_ORDER, type AiId } from "./ais";

type Points = Partial<Record<AiId, number>>;
export type QuizQuestion = { id: string; q: string; ayuda?: string; max: number; options: { label: string; points: Points }[] };

export const MATCH_QUIZ: QuizQuestion[] = [
  {
    id: "actividad",
    q: "¿En qué usarás más tus IAs?",
    ayuda: "Elige hasta 2",
    max: 2,
    options: [
      { label: "Crear contenido y marketing", points: { jasper: 4, grammarly: 1, ideogram: 1 } },
      { label: "Programar", points: { tabnine: 4, qodo: 3 } },
      { label: "Estudiar o investigar", points: { elicit: 4, grammarly: 1, gamma: 1 } },
      { label: "Analizar datos y hojas de cálculo", points: { julius: 4, notion: 1 } },
      { label: "Diseñar o crear imágenes", points: { midjourney: 4, ideogram: 3 } },
      { label: "Organizar mi trabajo y mis tareas", points: { notion: 4, gamma: 1 } },
      { label: "Presentaciones o videos", points: { gamma: 4, synthesia: 3 } },
    ],
  },
  {
    id: "resultado",
    q: "¿Qué resultado necesitas con más frecuencia?",
    max: 1,
    options: [
      { label: "Textos listos para publicar o enviar", points: { jasper: 3, grammarly: 2 } },
      { label: "Código que funcione y sin errores", points: { tabnine: 3, qodo: 3 } },
      { label: "Respuestas con evidencia y datos", points: { elicit: 3, julius: 3 } },
      { label: "Piezas visuales", points: { midjourney: 3, ideogram: 3 } },
      { label: "Planes y documentos organizados", points: { notion: 3, gamma: 1 } },
      { label: "Algo para presentar o mostrar en video", points: { gamma: 3, synthesia: 3 } },
    ],
  },
  {
    id: "dolor",
    q: "¿Qué es lo que más tiempo te quita hoy?",
    max: 1,
    options: [
      { label: "Escribir desde cero", points: { jasper: 3, synthesia: 1 } },
      { label: "Corregir ortografía, redacción o tono", points: { grammarly: 4 } },
      { label: "Encontrar errores y probar mi código", points: { qodo: 4, tabnine: 1 } },
      { label: "Escribir código repetitivo", points: { tabnine: 4 } },
      { label: "Leer y resumir mucha información", points: { elicit: 3, notion: 1 } },
      { label: "Pelear con hojas de cálculo", points: { julius: 4 } },
      { label: "Diseñar sin ser diseñador", points: { ideogram: 3, midjourney: 2, gamma: 1 } },
    ],
  },
  {
    id: "visual",
    q: "Si necesitas contenido visual, ¿de qué tipo?",
    max: 1,
    options: [
      { label: "Arte, ilustraciones o fotos impactantes", points: { midjourney: 4 } },
      { label: "Logos, pósters o publicaciones con texto", points: { ideogram: 4 } },
      { label: "Videos con un presentador", points: { synthesia: 4 } },
      { label: "Diapositivas", points: { gamma: 3 } },
      { label: "No necesito contenido visual", points: { grammarly: 1, notion: 1, julius: 1, tabnine: 1 } },
    ],
  },
  {
    id: "contexto",
    q: "¿Dónde usas lo que produces?",
    max: 1,
    options: [
      { label: "Redes sociales y marketing", points: { jasper: 2, ideogram: 2, synthesia: 1 } },
      { label: "Universidad o investigación", points: { elicit: 2, grammarly: 1, gamma: 1 } },
      { label: "Trabajo de oficina o en equipo", points: { notion: 2, gamma: 1, julius: 1 } },
      { label: "Desarrollo de software", points: { tabnine: 2, qodo: 2 } },
      { label: "Proyectos personales o creativos", points: { midjourney: 2, jasper: 1 } },
    ],
  },
];

export type MatchAnswers = number[][];

/** Valida la forma de las respuestas (índices dentro de rango, respetando el máximo por pregunta). */
export function validAnswers(a: MatchAnswers) {
  return (
    a.length === MATCH_QUIZ.length &&
    a.every((sel, i) => {
      const q = MATCH_QUIZ[i]!;
      return sel.length >= 1 && sel.length <= q.max && new Set(sel).size === sel.length && sel.every((o) => Number.isInteger(o) && o >= 0 && o < q.options.length);
    })
  );
}

/** Ranking de IAs (de mayor a menor). Empates: orden del catálogo. */
export function rankAis(a: MatchAnswers) {
  const score = Object.fromEntries(AI_ORDER.map((id) => [id, 0])) as Record<AiId, number>;
  a.forEach((sel, i) => sel.forEach((o) => {
    for (const [id, p] of Object.entries(MATCH_QUIZ[i]!.options[o]!.points)) score[id as AiId] += p ?? 0;
  }));
  const top = Math.max(1, ...Object.values(score));
  return [...AI_ORDER]
    .sort((x, y) => score[y] - score[x] || AI_ORDER.indexOf(x) - AI_ORDER.indexOf(y))
    .map((id) => ({ id, score: score[id], pct: Math.round(60 + (score[id] / top) * 38) }));
}

export const topAis = (a: MatchAnswers, n: number) => rankAis(a).slice(0, n);
