// Generación de texto (Gemini) e imágenes (Qwen-Image 2.1) del lado del servidor.
// Solo se importa dentro de handlers de server functions: await import("@/lib/ai.server").

import { TOOLS, identityRule } from "./demo-config";

export type Turn = { role: "user" | "model"; text: string };
export type TextResult = { ok: true; text: string } | { ok: false; busy: boolean };
export type ImageResult =
  | { ok: true; kind: "imagen"; bytes: Uint8Array; mime: string; prompt: string }
  | { ok: true; kind: "texto"; text: string }
  | { ok: false; busy: boolean; blocked?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const env = (k: string) => process.env[k] || "";

// Llama a Gemini probando varios modelos y reintentando si hay alta demanda (503/429/500).
async function callGemini(models: string[], body: unknown): Promise<Response | null> {
  const key = env("GEMINI_API_KEY");
  if (!key) return null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
      });
      if (res.ok) return res;
      console.error("Gemini error", model, res.status, await res.text());
      if (![429, 500, 503].includes(res.status)) break;
      await sleep(800);
    }
  }
  return null;
}

type TextOptions = { model?: string | undefined; maxOutputTokens?: number; json?: boolean };

export async function generateText(system: string, turns: Turn[], { model = "gemini-3.1-flash-lite", maxOutputTokens = 800, json = false }: TextOptions = {}): Promise<TextResult> {
  if (!env("GEMINI_API_KEY")) return { ok: false, busy: false };
  const res = await callGemini([model, "gemini-flash-lite-latest"], {
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: { maxOutputTokens, ...(json ? { responseMimeType: "application/json" } : {}) },
  });
  if (!res) return { ok: false, busy: true };
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  return text ? { ok: true, text } : { ok: false, busy: false };
}

/**
 * Filtro único de la herramienta de imágenes (Gemini, antes de Qwen):
 * decide si el mensaje pide una imagen o es conversación, bloquea contenido no apto
 * y escribe el prompt final con el estilo propio de la herramienta, como si fuera esa IA.
 */
function imageFilterPrompt() {
  const tool = TOOLS.Imagen;
  return `Eres el motor interno de ${tool.nombre} (${tool.descripcion}). Lee la conversación y decide qué hacer con el ÚLTIMO mensaje del usuario.
Responde SOLO con JSON, en una de estas formas:
{"accion":"imagen","prompt":"..."}
{"accion":"responder","texto":"..."}
{"accion":"bloquear"}

- "imagen": el usuario pide crear una imagen o cambiar la anterior. Escribe "prompt" en inglés, completo y autocontenido (sujeto, acción, entorno, composición, estilo, luz, colores, encuadre), de 40 a 120 palabras. Si pide cambios sobre la imagen anterior, reescribe el prompt anterior con esos cambios. Aplica el estilo característico de ${tool.nombre}: ${tool.promptSistema}. Si el usuario pide otro estilo, respeta el suyo. Si quiere texto dentro de la imagen, inclúyelo literal entre comillas.
- "responder": es un saludo, una pregunta o conversación que no pide una imagen. Contesta en español, breve y cercano, como ${tool.nombre}, y sugiere una idea de imagen.${identityRule(tool.nombre)}
- "bloquear": contenido sexual o desnudos, violencia gráfica, odio, actividades ilegales, menores en contextos inapropiados o imitar a una persona real de forma engañosa.`;
}

type FilterDecision = { accion: "imagen"; prompt: string } | { accion: "responder"; texto: string } | { accion: "bloquear" };

async function imageFilter(turns: Turn[]): Promise<FilterDecision | "busy"> {
  const r = await generateText(imageFilterPrompt(), turns, { maxOutputTokens: 500, json: true });
  if (!r.ok) return "busy"; // sin filtro no se genera nada (el modelo de imagen no trae filtro propio)
  try {
    const d = JSON.parse(r.text.replace(/^```(?:json)?|```$/g, "").trim()) as Partial<{ accion: string; prompt: string; texto: string }>;
    if (d.accion === "imagen" && d.prompt?.trim()) return { accion: "imagen", prompt: d.prompt.trim() };
    if (d.accion === "responder" && d.texto?.trim()) return { accion: "responder", texto: d.texto.trim() };
    if (d.accion === "bloquear") return { accion: "bloquear" };
  } catch {
    console.error("Filtro de imagen: respuesta no es JSON", r.text.slice(0, 200));
  }
  return "busy";
}

/** Proveedor de imágenes: "local" (tu servidor Qwen), "modelscope" (API gratis) o "gemini". */
export function imageProvider() {
  const forced = env("IMAGE_PROVIDER");
  if (forced) return forced;
  if (env("QWEN_IMAGE_URL")) return "local";
  if (env("MODELSCOPE_TOKEN")) return "modelscope";
  return "gemini";
}

/**
 * Genera una imagen pasando primero por el filtro. `history` = turnos previos del chat (para "hazlo más azul").
 * Puede devolver texto si el mensaje no pedía una imagen.
 */
export async function generateImage(message: string, history: Turn[] = []): Promise<ImageResult> {
  const decision = await imageFilter([...history, { role: "user", text: message }]);
  if (decision === "busy") return { ok: false, busy: true };
  if (decision.accion === "bloquear") return { ok: false, busy: false, blocked: true };
  if (decision.accion === "responder") return { ok: true, kind: "texto", text: decision.texto };
  const provider = imageProvider();
  try {
    const img = provider === "local" ? await viaLocalQwen(decision.prompt) : provider === "modelscope" ? await viaModelScope(decision.prompt) : await viaGemini(decision.prompt);
    return img.ok ? { ...img, kind: "imagen", prompt: decision.prompt } : img;
  } catch (e) {
    console.error("Image generation failed", provider, e);
    return { ok: false, busy: true };
  }
}

type RawImage = { ok: true; bytes: Uint8Array; mime: string } | { ok: false; busy: boolean };

// Servidor propio (tools/qwen-image-server): POST /generate { prompt } -> { image: base64, mime }.
async function viaLocalQwen(prompt: string): Promise<RawImage> {
  const url = env("QWEN_IMAGE_URL").replace(/\/$/, "");
  const res = await fetch(`${url}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("QWEN_IMAGE_TOKEN")}`, "ngrok-skip-browser-warning": "1" },
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) {
    console.error("Qwen local error", res.status, await res.text());
    return { ok: false, busy: true };
  }
  const json = (await res.json()) as { image?: string; mime?: string };
  if (!json.image) return { ok: false, busy: false };
  return { ok: true, bytes: Uint8Array.from(Buffer.from(json.image, "base64")), mime: json.mime || "image/jpeg" };
}

// ModelScope API-Inference (gratis con cupo diario). Tarea asíncrona: se crea y se consulta hasta que termine.
async function viaModelScope(prompt: string): Promise<RawImage> {
  const base = "https://api-inference.modelscope.cn/";
  const headers = { Authorization: `Bearer ${env("MODELSCOPE_TOKEN")}`, "Content-Type": "application/json" };
  const create = await fetch(`${base}v1/images/generations`, {
    method: "POST",
    headers: { ...headers, "X-ModelScope-Async-Mode": "true" },
    body: JSON.stringify({ model: env("MODELSCOPE_IMAGE_MODEL") || "Qwen/Qwen-Image-2.1", prompt }),
  });
  if (!create.ok) {
    console.error("ModelScope error", create.status, await create.text());
    return { ok: false, busy: true };
  }
  const { task_id } = (await create.json()) as { task_id?: string };
  if (!task_id) return { ok: false, busy: false };
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const poll = await fetch(`${base}v1/tasks/${task_id}`, { headers: { ...headers, "X-ModelScope-Task-Type": "image_generation" } });
    if (!poll.ok) continue;
    const task = (await poll.json()) as { task_status?: string; output_images?: string[] };
    if (task.task_status === "SUCCEED" && task.output_images?.[0]) {
      const img = await fetch(task.output_images[0]);
      return { ok: true, bytes: new Uint8Array(await img.arrayBuffer()), mime: img.headers.get("content-type") || "image/jpeg" };
    }
    if (task.task_status === "FAILED") return { ok: false, busy: true };
  }
  return { ok: false, busy: true };
}

async function viaGemini(prompt: string): Promise<RawImage> {
  const key = env("GEMINI_API_KEY");
  if (!key) return { ok: false, busy: false };
  const model = env("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
  });
  if (!res.ok) {
    // 429 / limit 0 = el plan gratuito no incluye generación de imágenes.
    console.error("Gemini image error", res.status, await res.text());
    return { ok: false, busy: [402, 429, 503].includes(res.status) };
  }
  const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[] };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) return { ok: false, busy: false };
  return { ok: true, bytes: Uint8Array.from(Buffer.from(part.inlineData.data, "base64")), mime: part.inlineData.mimeType || "image/png" };
}
