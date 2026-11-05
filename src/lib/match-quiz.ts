// Tests de match de la app (después de "comprar" un pack): puntúan cada IA del catálogo.
// La empresa hace su test una vez y cada cuenta hace el suyo; el de la empresa influye en el de cada cuenta.
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

/** Test de la empresa: lo hace quien compra el pack. */
export const EMPRESA_QUIZ: QuizQuestion[] = [
  {
    id: "areas",
    q: "¿En qué áreas usará IA tu equipo?",
    ayuda: "Elige hasta 3",
    max: 3,
    options: [
      { label: "Marketing y contenido", points: { jasper: 4, grammarly: 1, ideogram: 1 } },
      { label: "Desarrollo de software", points: { tabnine: 4, qodo: 3 } },
      { label: "Investigación y análisis", points: { elicit: 3, julius: 3 } },
      { label: "Diseño y piezas gráficas", points: { ideogram: 4, midjourney: 3 } },
      { label: "Operaciones y gestión de proyectos", points: { notion: 4 } },
      { label: "Ventas y presentaciones a clientes", points: { gamma: 4, synthesia: 2 } },
      { label: "Capacitación y comunicación interna", points: { synthesia: 4, gamma: 1 } },
    ],
  },
  {
    id: "objetivo",
    q: "¿Qué quiere lograr primero tu empresa con la IA?",
    max: 1,
    options: [
      { label: "Producir más contenido en menos tiempo", points: { jasper: 3, ideogram: 1, synthesia: 1 } },
      { label: "Entregar software más rápido y con menos errores", points: { tabnine: 3, qodo: 3 } },
      { label: "Tomar decisiones con datos", points: { julius: 4, elicit: 2 } },
      { label: "Comunicar mejor con clientes y aliados", points: { grammarly: 3, gamma: 2 } },
      { label: "Ordenar procesos y el conocimiento del equipo", points: { notion: 4 } },
      { label: "Crear material visual sin depender de un diseñador", points: { ideogram: 3, midjourney: 3 } },
    ],
  },
  {
    id: "entregables",
    q: "¿Qué entrega tu empresa con más frecuencia?",
    max: 1,
    options: [
      { label: "Publicaciones y campañas", points: { jasper: 2, ideogram: 2, midjourney: 1 } },
      { label: "Software o productos digitales", points: { tabnine: 2, qodo: 2 } },
      { label: "Informes y análisis", points: { julius: 3, elicit: 2 } },
      { label: "Propuestas y presentaciones comerciales", points: { gamma: 3, grammarly: 1 } },
      { label: "Videos de producto o de capacitación", points: { synthesia: 4 } },
      { label: "Documentos y procesos internos", points: { notion: 3, grammarly: 1 } },
    ],
  },
  {
    id: "equipo",
    q: "¿Cómo es la mayoría de tu equipo?",
    max: 1,
    options: [
      { label: "Técnico: desarrollo o datos", points: { tabnine: 2, qodo: 2, julius: 2 } },
      { label: "Creativo o comercial", points: { jasper: 2, ideogram: 2, gamma: 1, synthesia: 1 } },
      { label: "Administrativo u operativo", points: { notion: 2, grammarly: 2 } },
      { label: "Mixto", points: { notion: 2, julius: 1, gamma: 1 } },
    ],
  },
  {
    id: "dolor",
    q: "¿Qué le pesa más hoy a tu empresa?",
    max: 1,
    options: [
      { label: "Depender de agencias o freelancers para el contenido", points: { jasper: 2, ideogram: 2, synthesia: 2 } },
      { label: "Errores y retrabajo en el código", points: { qodo: 4 } },
      { label: "Información dispersa entre herramientas", points: { notion: 4 } },
      { label: "Mucho tiempo armando informes", points: { julius: 3, gamma: 1 } },
      { label: "Revisar textos antes de enviarlos", points: { grammarly: 4 } },
      { label: "Leer estudios o documentación larga", points: { elicit: 4 } },
    ],
  },
];

/** Cuánto pesa el test de la empresa en el match de cada cuenta (el de la persona pesa 1). */
export const EMPRESA_PESO = 0.3;

export type MatchAnswers = number[][];

/** Valida la forma de las respuestas (índices dentro de rango, respetando el máximo por pregunta). */
export function validAnswers(a: MatchAnswers, quiz: QuizQuestion[] = MATCH_QUIZ) {
  return (
    a.length === quiz.length &&
    a.every((sel, i) => {
      const q = quiz[i]!;
      return sel.length >= 1 && sel.length <= q.max && new Set(sel).size === sel.length && sel.every((o) => Number.isInteger(o) && o >= 0 && o < q.options.length);
    })
  );
}

/** Puntaje de cada IA, de 0 a 1 (1 = la mejor de ese test). */
function scores(a: MatchAnswers, quiz: QuizQuestion[]) {
  const score = Object.fromEntries(AI_ORDER.map((id) => [id, 0])) as Record<AiId, number>;
  a.forEach((sel, i) => sel.forEach((o) => {
    for (const [id, p] of Object.entries(quiz[i]!.options[o]!.points)) score[id as AiId] += p ?? 0;
  }));
  const top = Math.max(1, ...Object.values(score));
  for (const id of AI_ORDER) score[id] /= top;
  return score;
}

/** Ordena de mayor a menor. Empates: orden del catálogo. */
function rank(score: Record<AiId, number>) {
  const top = Math.max(1e-9, ...Object.values(score));
  return [...AI_ORDER]
    .sort((x, y) => score[y] - score[x] || AI_ORDER.indexOf(x) - AI_ORDER.indexOf(y))
    .map((id) => ({ id, score: score[id], pct: Math.round(60 + (score[id] / top) * 38) }));
}

/** Ranking de una cuenta: su test más el de su empresa (si ya lo hizo), con peso EMPRESA_PESO. */
export function rankAis(a: MatchAnswers, empresa?: MatchAnswers | null) {
  const p = scores(a, MATCH_QUIZ);
  const e = empresa ? scores(empresa, EMPRESA_QUIZ) : null;
  return rank(Object.fromEntries(AI_ORDER.map((id) => [id, p[id] + (e ? EMPRESA_PESO * e[id] : 0)])) as Record<AiId, number>);
}

export const rankEmpresa = (a: MatchAnswers) => rank(scores(a, EMPRESA_QUIZ));

export const topAis = (a: MatchAnswers, n: number, empresa?: MatchAnswers | null) => rankAis(a, empresa).slice(0, n);
