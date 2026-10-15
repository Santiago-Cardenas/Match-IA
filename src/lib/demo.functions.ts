import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { DEMO_UNAVAILABLE, LIMITS, MAX_CHAT_MESSAGES, MAX_INPUT_CHARS, TOOLS, type Cat } from "./demo-config";

type Result = { ok: true; text?: string; image?: string } | { ok: false; reason: "agotada" | "error"; message: string };

const unavailable = (reason: "agotada" | "error"): Result => ({ ok: false, reason, message: DEMO_UNAVAILABLE });

async function checkQuota(email: string, kind: "text" | "image", categoria: string, record: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count: leads } = await supabaseAdmin.from("leads_test").select("id", { count: "exact", head: true }).ilike("email", email);
  if (!leads) return false;
  if (!record) return true;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ count: mine }, { count: daily }] = await Promise.all([
    supabaseAdmin.from("demo_usage").select("id", { count: "exact", head: true }).eq("kind", kind).ilike("email", email),
    supabaseAdmin.from("demo_usage").select("id", { count: "exact", head: true }).eq("kind", kind).gte("created_at", since),
  ]);
  const perEmail = kind === "text" ? LIMITS.textoPorCorreo : LIMITS.imagenPorCorreo;
  const perDay = kind === "text" ? LIMITS.textoDiario : LIMITS.imagenDiario;
  if ((mine ?? 0) >= perEmail || (daily ?? 0) >= perDay) return false;
  const { error } = await supabaseAdmin.from("demo_usage").insert({ email, kind, categoria });
  return !error;
}

const textInput = z.object({
  email: z.string().trim().email().max(255),
  categoria: z.enum(["Escritura", "Productividad", "Código"]),
  messages: z
    .array(z.object({ role: z.enum(["user", "model"]), text: z.string().trim().min(1).max(MAX_INPUT_CHARS * 2) }))
    .min(1)
    .max(MAX_CHAT_MESSAGES * 2),
});

export const runTextDemo = createServerFn({ method: "POST" })
  .inputValidator((d) => textInput.parse(d))
  .handler(async ({ data }): Promise<Result> => {
    const tool = TOOLS[data.categoria as Cat];
    const users = data.messages.filter((m) => m.role === "user");
    const last = data.messages[data.messages.length - 1]!;
    if (last.role !== "user" || last.text.length > MAX_INPUT_CHARS) return unavailable("error");
    const maxUser = tool.demo === "chat" ? MAX_CHAT_MESSAGES : 1;
    if (users.length > maxUser) return unavailable("agotada");
    const messages = tool.demo === "chat" ? data.messages : [last];

    const key = process.env["GEMINI_API_KEY"];
    if (!key) return unavailable("error");
    try {
      // A chat session counts as one use; only its first message consumes quota.
      const ok = await checkQuota(data.email, "text", data.categoria, users.length === 1);
      if (!ok) return unavailable("agotada");
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${tool.modelo}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: tool.promptSistema }] },
            contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
            generationConfig: { maxOutputTokens: 400 },
          }),
        },
      );
      if (!res.ok) {
        console.error("Gemini error", res.status, await res.text());
        return unavailable("error");
      }
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      return text ? { ok: true, text } : unavailable("error");
    } catch (e) {
      console.error("Text demo failed", e);
      return unavailable("error");
    }
  });

const imageInput = z.object({ email: z.string().trim().email().max(255), prompt: z.string().trim().min(1).max(MAX_INPUT_CHARS) });

export const runImageDemo = createServerFn({ method: "POST" })
  .inputValidator((d) => imageInput.parse(d))
  .handler(async ({ data }): Promise<Result> => {
    const key = process.env["GEMINI_API_KEY"];
    if (!key) return unavailable("error");
    const tool = TOOLS.Imagen;
    const model = process.env["GEMINI_IMAGE_MODEL"] || tool.modelo;
    try {
      const ok = await checkQuota(data.email, "image", "Imagen", true);
      if (!ok) return unavailable("agotada");
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: tool.promptSistema + data.prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      });
      if (!res.ok) {
        // 429 / limit 0 = el plan gratuito no incluye generación de imágenes.
        console.error("Gemini image error", res.status, await res.text());
        return unavailable(res.status === 402 || res.status === 429 ? "agotada" : "error");
      }
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
      };
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      const b64 = part?.inlineData?.data;
      const mime = part?.inlineData?.mimeType || "image/png";
      return b64 ? { ok: true, image: `data:${mime};base64,${b64}` } : unavailable("error");
    } catch (e) {
      console.error("Image demo failed", e);
      return unavailable("error");
    }
  });
