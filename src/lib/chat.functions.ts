import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { APP_LIMITS, APP_MESSAGES, APP_PROMPTS, HISTORY_TURNS, MAX_MESSAGE_CHARS } from "./app-config";
import { TOOLS, identityRule, type Cat } from "./demo-config";

const CATS = ["Escritura", "Video", "Imagen", "Código", "Productividad"] as const;

export type ChatMessage = {
  id: string;
  role: "user" | "model";
  tipo: "texto" | "imagen" | "aviso";
  contenido: string;
  imagen_url: string | null;
  herramienta: string | null;
  created_at: string;
};

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Valida el token de sesión del navegador y devuelve el usuario. */
async function requireUser(token: string) {
  const db = await admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("Sesión inválida");
  return { db, user: data.user };
}

type Db = Awaited<ReturnType<typeof admin>>;

/** Respuestas exitosas de la IA en las últimas 24 h (los avisos y errores no cuentan). */
async function usage(db: Db, tipo: "texto" | "imagen", userId?: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  let q = db.from("messages").select("id", { count: "exact", head: true }).eq("role", "model").eq("tipo", tipo).gte("created_at", since);
  if (userId) q = q.eq("user_id", userId);
  const { count } = await q;
  return count ?? 0;
}

const sendInput = z.object({
  token: z.string().min(10).max(4000),
  chatId: z.string().uuid().nullable(),
  herramienta: z.enum(CATS),
  texto: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
});

export type SendResult =
  | { ok: true; chatId: string; titulo: string; user: ChatMessage; reply: ChatMessage }
  | { ok: false; message: string };

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => sendInput.parse(d))
  .handler(async ({ data }): Promise<SendResult> => {
    let ctx;
    try {
      ctx = await requireUser(data.token);
    } catch {
      return { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    const { db, user } = ctx;
    const cat = data.herramienta as Cat;
    const tool = TOOLS[cat];

    // Chat existente (del mismo usuario) o uno nuevo con el inicio del mensaje como título.
    let chatId = data.chatId;
    let titulo = "";
    if (chatId) {
      const { data: chat } = await db.from("chats").select("id, titulo, user_id").eq("id", chatId).maybeSingle();
      if (!chat || chat.user_id !== user.id) return { ok: false, message: "No encontramos ese chat." };
      titulo = chat.titulo;
    } else {
      titulo = data.texto.replace(/\s+/g, " ").slice(0, 60);
      const { data: chat, error } = await db.from("chats").insert({ user_id: user.id, titulo, herramienta: cat }).select("id").single();
      if (error || !chat) return { ok: false, message: APP_MESSAGES.error };
      chatId = chat.id;
    }

    const { data: userMsg, error: userErr } = await db
      .from("messages")
      .insert({ chat_id: chatId, user_id: user.id, role: "user", tipo: "texto", contenido: data.texto, herramienta: cat })
      .select("*")
      .single();
    if (userErr || !userMsg) return { ok: false, message: APP_MESSAGES.error };

    const reply = await answer(db, user.id, chatId, cat, tool.modelo, data.texto);
    const { data: replyMsg } = await db
      .from("messages")
      .insert({ chat_id: chatId, user_id: user.id, role: "model", herramienta: cat, ...reply })
      .select("*")
      .single();
    await db.from("chats").update({ herramienta: cat }).eq("id", chatId); // actualiza updated_at
    if (!replyMsg) return { ok: false, message: APP_MESSAGES.error };
    return { ok: true, chatId, titulo, user: userMsg as ChatMessage, reply: replyMsg as ChatMessage };
  });

type Reply = { tipo: "texto" | "imagen" | "aviso"; contenido: string; imagen_url?: string | null };

async function answer(db: Db, userId: string, chatId: string, cat: Cat, modelo: string | null, texto: string): Promise<Reply> {
  const aviso = (contenido: string): Reply => ({ tipo: "aviso", contenido });
  if (cat === "Video") return aviso(APP_MESSAGES.sinVideo);
  const ai = await import("./ai.server");

  if (cat === "Imagen") {
    const [mine, all] = await Promise.all([usage(db, "imagen", userId), usage(db, "imagen")]);
    if (mine >= APP_LIMITS.imagenPorUsuario || all >= APP_LIMITS.imagenGlobal) return aviso(APP_MESSAGES.limiteImagen);
    // Contexto para el filtro: mensajes recientes y los prompts de las imágenes anteriores (permite "hazlo más azul").
    const { data: recent } = await db
      .from("messages")
      .select("role, tipo, contenido")
      .eq("chat_id", chatId)
      .neq("tipo", "aviso")
      .order("created_at", { ascending: false })
      .limit(10);
    const history = (recent ?? [])
      .reverse()
      .slice(0, -1) // el último es el mensaje actual
      .map((r) => ({ role: r.role as "user" | "model", text: r.tipo === "imagen" ? `[Imagen generada con el prompt: ${r.contenido}]` : r.contenido }));
    while (history.length && history[0]!.role !== "user") history.shift();
    const img = await ai.generateImage(texto, history);
    if (!img.ok) return aviso(img.blocked ? APP_MESSAGES.bloqueado : img.busy ? APP_MESSAGES.ocupado : APP_MESSAGES.error);
    if (img.kind === "texto") return { tipo: "texto", contenido: img.text };
    const ext = img.mime.includes("png") ? "png" : img.mime.includes("webp") ? "webp" : "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from("chat-images").upload(path, img.bytes, { contentType: img.mime });
    if (error) {
      console.error("No se pudo guardar la imagen", error);
      return aviso(APP_MESSAGES.error);
    }
    // contenido = prompt final (no se muestra; sirve de contexto para cambios posteriores)
    return { tipo: "imagen", contenido: img.prompt, imagen_url: db.storage.from("chat-images").getPublicUrl(path).data.publicUrl };
  }

  const [mine, all] = await Promise.all([usage(db, "texto", userId), usage(db, "texto")]);
  if (mine >= APP_LIMITS.textoPorUsuario || all >= APP_LIMITS.textoGlobal) return aviso(APP_MESSAGES.limiteTexto);
  // Historial del chat (solo texto), del más antiguo al más reciente; el último es el mensaje recién guardado.
  const { data: rows } = await db
    .from("messages")
    .select("role, tipo, contenido")
    .eq("chat_id", chatId)
    .eq("tipo", "texto")
    .order("created_at", { ascending: false })
    .limit(HISTORY_TURNS);
  const turns = (rows ?? []).reverse().map((r) => ({ role: r.role as "user" | "model", text: r.contenido }));
  while (turns.length && turns[0]!.role !== "user") turns.shift(); // Gemini exige empezar con el usuario
  const res = await ai.generateText(APP_PROMPTS[cat] + identityRule(TOOLS[cat].nombre), turns.length ? turns : [{ role: "user", text: texto }], {
    model: modelo ?? undefined,
    maxOutputTokens: 1500,
  });
  if (!res.ok) return aviso(res.busy ? APP_MESSAGES.ocupado : APP_MESSAGES.error);
  return { tipo: "texto", contenido: res.text };
}

/** Datos iniciales de la app: IA recomendada por el test (si lo hizo con ese correo) y uso del día. */
export const getAppInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10).max(4000) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const email = user.email ?? "";
      const [{ data: test }, texto, imagen] = await Promise.all([
        db.from("test_sessions").select("categoria_ganadora").ilike("email", email).not("categoria_ganadora", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        usage(db, "texto", user.id),
        usage(db, "imagen", user.id),
      ]);
      const rec = test?.categoria_ganadora;
      return {
        ok: true as const,
        recomendada: (CATS as readonly string[]).includes(rec ?? "") ? (rec as Cat) : null,
        restantes: { texto: Math.max(0, APP_LIMITS.textoPorUsuario - texto), imagen: Math.max(0, APP_LIMITS.imagenPorUsuario - imagen) },
      };
    } catch {
      return { ok: false as const };
    }
  });
