import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { API_BUSY, DEMO_UNAVAILABLE, LIMITS, MAX_DEMO_PROMPTS, MAX_INPUT_CHARS, TOOLS, identityRule, type Cat } from "./demo-config";

type Result = { ok: true; text?: string; image?: string } | { ok: false; reason: "agotada" | "error"; message: string };

const unavailable = (reason: "agotada" | "error"): Result => ({ ok: false, reason, message: DEMO_UNAVAILABLE });
const apiBusy = (): Result => ({ ok: false, reason: "agotada", message: API_BUSY });

// Cada prompt cuenta como un uso. Devuelve null si no hay cupo; si hay, una función que registra el uso.
async function checkQuota(email: string, kind: "text" | "image", categoria: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count: leads } = await supabaseAdmin.from("leads_test").select("id", { count: "exact", head: true }).ilike("email", email);
  if (!leads) return null;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ count: mine }, { count: daily }] = await Promise.all([
    supabaseAdmin.from("demo_usage").select("id", { count: "exact", head: true }).eq("kind", kind).ilike("email", email),
    supabaseAdmin.from("demo_usage").select("id", { count: "exact", head: true }).eq("kind", kind).gte("created_at", since),
  ]);
  const perEmail = kind === "text" ? LIMITS.textoPorCorreo : LIMITS.imagenPorCorreo;
  const perDay = kind === "text" ? LIMITS.textoDiario : LIMITS.imagenDiario;
  if ((mine ?? 0) >= perEmail || (daily ?? 0) >= perDay) return null;
  return async () => {
    await supabaseAdmin.from("demo_usage").insert({ email, kind, categoria });
  };
}

const textInput = z.object({
  email: z.string().trim().email().max(255),
  categoria: z.enum(["Escritura", "Productividad", "Código"]),
  messages: z
    .array(z.object({ role: z.enum(["user", "model"]), text: z.string().trim().min(1).max(MAX_INPUT_CHARS * 2) }))
    .min(1)
    .max(MAX_DEMO_PROMPTS * 2),
});

export const runTextDemo = createServerFn({ method: "POST" })
  .inputValidator((d) => textInput.parse(d))
  .handler(async ({ data }): Promise<Result> => {
    const tool = TOOLS[data.categoria as Cat];
    const users = data.messages.filter((m) => m.role === "user");
    const last = data.messages[data.messages.length - 1]!;
    if (last.role !== "user" || last.text.length > MAX_INPUT_CHARS) return unavailable("error");
    if (users.length > MAX_DEMO_PROMPTS) return unavailable("agotada");
    try {
      const commit = await checkQuota(data.email, "text", data.categoria);
      if (!commit) return unavailable("agotada");
      const { generateText } = await import("./ai.server");
      const res = await generateText(tool.promptSistema + identityRule(tool.nombre), data.messages, { model: tool.modelo!, maxOutputTokens: 400 });
      if (!res.ok) return res.busy ? apiBusy() : unavailable("error");
      await commit();
      return { ok: true, text: res.text };
    } catch (e) {
      console.error("Text demo failed", e);
      return unavailable("error");
    }
  });

const imageInput = z.object({ email: z.string().trim().email().max(255), prompt: z.string().trim().min(1).max(MAX_INPUT_CHARS) });

export const runImageDemo = createServerFn({ method: "POST" })
  .inputValidator((d) => imageInput.parse(d))
  .handler(async ({ data }): Promise<Result> => {
    try {
      const commit = await checkQuota(data.email, "image", "Imagen");
      if (!commit) return unavailable("agotada");
      const { generateImage } = await import("./ai.server");
      const res = await generateImage(data.prompt);
      if (!res.ok) {
        if (res.blocked) return { ok: false, reason: "error", message: "No podemos generar esa imagen. Prueba con otra descripción." };
        return res.busy ? apiBusy() : unavailable("error");
      }
      if (res.kind === "texto") return { ok: true, text: res.text }; // pregunta o saludo: no gasta el cupo de imagen
      await commit();
      return { ok: true, image: `data:${res.mime};base64,${Buffer.from(res.bytes).toString("base64")}` };
    } catch (e) {
      console.error("Image demo failed", e);
      return unavailable("error");
    }
  });
