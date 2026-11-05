// Generación de texto (Gemini) e imágenes (Qwen-Image 2.1) del lado del servidor.
// Solo se importa dentro de handlers de server functions: await import("@/lib/ai.server").

export type Turn = { role: "user" | "model"; text: string };
export type TextResult = { ok: true; text: string } | { ok: false; busy: boolean };
export type ImageResult = { ok: true; bytes: Uint8Array; mime: string } | { ok: false; busy: boolean; blocked?: boolean };

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

export async function generateText(system: string, turns: Turn[], model = "gemini-3.1-flash-lite", maxOutputTokens = 800): Promise<TextResult> {
  if (!env("GEMINI_API_KEY")) return { ok: false, busy: false };
  const res = await callGemini([model, "gemini-flash-lite-latest"], {
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: { maxOutputTokens },
  });
  if (!res) return { ok: false, busy: true };
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  return text ? { ok: true, text } : { ok: false, busy: false };
}

// El modelo de imagen abierto no trae filtro de contenido: Gemini revisa y mejora el prompt antes.
const PROMPT_GUARD =
  "Convierte la petición del usuario en un prompt descriptivo y detallado (sujeto, estilo, luz, composición) para un generador de imágenes, en el mismo idioma. " +
  "La imagen debe ser apta para todo público. Si la petición es sexual, de violencia gráfica, de odio, ilegal o busca imitar a una persona real de forma engañosa, responde exactamente: BLOQUEADO. " +
  "Responde solo con el prompt, sin comillas ni explicaciones.";

async function safePrompt(prompt: string): Promise<string | null> {
  const r = await generateText(PROMPT_GUARD, [{ role: "user", text: prompt }], undefined, 300);
  if (!r.ok) return prompt; // si Gemini no responde, se usa el prompt original
  return r.text.trim().toUpperCase().startsWith("BLOQUEADO") ? null : r.text;
}

/** Proveedor de imágenes: "local" (tu servidor Qwen), "modelscope" (API gratis) o "gemini". */
export function imageProvider() {
  const forced = env("IMAGE_PROVIDER");
  if (forced) return forced;
  if (env("QWEN_IMAGE_URL")) return "local";
  if (env("MODELSCOPE_TOKEN")) return "modelscope";
  return "gemini";
}

export async function generateImage(rawPrompt: string): Promise<ImageResult> {
  const prompt = await safePrompt(rawPrompt);
  if (prompt === null) return { ok: false, busy: false, blocked: true };
  const provider = imageProvider();
  try {
    if (provider === "local") return await viaLocalQwen(prompt);
    if (provider === "modelscope") return await viaModelScope(prompt);
    return await viaGemini(prompt);
  } catch (e) {
    console.error("Image generation failed", provider, e);
    return { ok: false, busy: true };
  }
}

// Servidor propio (tools/qwen-image-server): POST /generate { prompt } -> { image: base64, mime }.
async function viaLocalQwen(prompt: string): Promise<ImageResult> {
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
async function viaModelScope(prompt: string): Promise<ImageResult> {
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

async function viaGemini(prompt: string): Promise<ImageResult> {
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
