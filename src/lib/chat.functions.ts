import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { APP_LIMITS, APP_MESSAGES, HISTORY_TURNS, MAX_MESSAGE_CHARS } from "./app-config";
import { AIS, AI_IDS, identityRule, toAiId, type Ai, type AiId } from "./ais";
import { MATCH_QUIZ, topAis, validAnswers } from "./match-quiz";
import { IMAGE_TOKENS, MES_COP, MES_DIAS, PLANS, TOKEN_PACKS, type PlanId } from "./plans";
import { USD_TO_COP } from "./test-config";

export type ChatMessage = {
  id: string;
  role: "user" | "model";
  tipo: "texto" | "imagen" | "aviso";
  contenido: string;
  imagen_url: string | null;
  herramienta: string | null;
  created_at: string;
};

export type Suscripcion = { plan: PlanId; ias: AiId[]; tokens: number };
/** Cómo se accede a una IA: incluida en el plan, acceso mensual, prueba diaria o saldo de tokens. */
export type Via = "plan" | "mes" | "prueba" | "tokens";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
type Db = Awaited<ReturnType<typeof admin>>;

/** Valida el token de sesión del navegador y devuelve el usuario. */
async function requireUser(token: string) {
  const db = await admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("Sesión inválida");
  return { db, user: data.user };
}

async function getSub(db: Db, userId: string): Promise<Suscripcion | null> {
  const { data } = await db.from("suscripciones").select("plan, ias, tokens").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return { plan: data.plan as PlanId, ias: data.ias.map(toAiId).filter((x): x is AiId => !!x), tokens: data.tokens ?? 0 };
}

const since24h = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString();

/** Prompts de prueba usados en las últimas 24 h, por IA. */
async function pruebasUsadas(db: Db, userId: string) {
  const { data } = await db.from("messages").select("herramienta").eq("user_id", userId).eq("role", "model").eq("acceso", "prueba").gte("created_at", since24h());
  const out: Partial<Record<AiId, number>> = {};
  for (const r of data ?? []) {
    const id = toAiId(r.herramienta);
    if (id) out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

async function accesosActivos(db: Db, userId: string) {
  const { data } = await db.from("accesos").select("ia, hasta").eq("user_id", userId).gt("hasta", new Date().toISOString());
  return Object.fromEntries((data ?? []).map((a) => [a.ia, a.hasta])) as Partial<Record<AiId, string>>;
}

/** Orden: plan, acceso mensual, prueba gratis del día y por último tokens. null = bloqueada. */
async function resolveAccess(db: Db, userId: string, sub: Suscripcion, ai: AiId): Promise<Via | null> {
  if (sub.ias.includes(ai)) return "plan";
  if ((await accesosActivos(db, userId))[ai]) return "mes";
  if (((await pruebasUsadas(db, userId))[ai] ?? 0) < PLANS[sub.plan].pruebasDiarias) return "prueba";
  if (sub.tokens > 0) return "tokens";
  return null;
}

const BLOQUEADA = "Ya usaste tu prueba de hoy de esta IA. Desbloquéala con acceso mensual o tokens para seguir.";

/** Respuestas exitosas de la IA en las últimas 24 h (los avisos y errores no cuentan). */
async function usage(db: Db, tipo: "texto" | "imagen", userId?: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  let q = db.from("messages").select("id", { count: "exact", head: true }).eq("role", "model").eq("tipo", tipo).gte("created_at", since);
  if (userId) q = q.eq("user_id", userId);
  const { count } = await q;
  return count ?? 0;
}

const token = z.string().min(10).max(4000);
const aiId = z.enum(AI_IDS as [AiId, ...AiId[]]);

export type SendResult =
  | { ok: true; chatId: string; titulo: string; user: ChatMessage; reply: ChatMessage }
  | { ok: false; message: string; bloqueada?: boolean };

// ---------- Enviar un mensaje ----------

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, chatId: z.string().uuid().nullable(), herramienta: aiId, texto: z.string().trim().min(1).max(MAX_MESSAGE_CHARS) }).parse(d))
  .handler(async ({ data }): Promise<SendResult> => {
    let ctx;
    try {
      ctx = await requireUser(data.token);
    } catch {
      return { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    const { db, user } = ctx;
    const sub = await getSub(db, user.id);
    if (!sub) return { ok: false, message: "Activa un plan para usar Matchia." };
    const via = await resolveAccess(db, user.id, sub, data.herramienta);
    if (!via) return { ok: false, message: BLOQUEADA, bloqueada: true };
    const ai = AIS[data.herramienta];

    // Chat existente (del mismo usuario) o uno nuevo con el inicio del mensaje como título.
    let chatId = data.chatId;
    let titulo = "";
    if (chatId) {
      const { data: chat } = await db.from("chats").select("id, titulo, user_id").eq("id", chatId).maybeSingle();
      if (!chat || chat.user_id !== user.id) return { ok: false, message: "No encontramos ese chat." };
      titulo = chat.titulo;
    } else {
      titulo = data.texto.replace(/\s+/g, " ").slice(0, 60);
      const { data: chat, error } = await db.from("chats").insert({ user_id: user.id, titulo, herramienta: ai.id }).select("id").single();
      if (error || !chat) return { ok: false, message: APP_MESSAGES.error };
      chatId = chat.id;
    }

    const { data: userMsg, error: userErr } = await db
      .from("messages")
      .insert({ chat_id: chatId, user_id: user.id, role: "user", tipo: "texto", contenido: data.texto, herramienta: ai.id })
      .select("*")
      .single();
    if (userErr || !userMsg) return { ok: false, message: APP_MESSAGES.error };

    const reply = await replyAndSave(db, user.id, chatId, ai, data.texto, via, sub);
    if (!reply) return { ok: false, message: APP_MESSAGES.error };
    return { ok: true, chatId, titulo, user: userMsg as ChatMessage, reply };
  });

// ---------- Editar un mensaje ya enviado y reenviarlo ----------

export type EditResult = { ok: true; user: ChatMessage; reply: ChatMessage } | { ok: false; message: string; bloqueada?: boolean };

export const editAndResend = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, messageId: z.string().uuid(), herramienta: aiId, texto: z.string().trim().min(1).max(MAX_MESSAGE_CHARS) }).parse(d))
  .handler(async ({ data }): Promise<EditResult> => {
    let ctx;
    try {
      ctx = await requireUser(data.token);
    } catch {
      return { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    const { db, user } = ctx;
    const sub = await getSub(db, user.id);
    if (!sub) return { ok: false, message: "Activa un plan para usar Matchia." };
    const via = await resolveAccess(db, user.id, sub, data.herramienta);
    if (!via) return { ok: false, message: BLOQUEADA, bloqueada: true };
    const { data: msg } = await db.from("messages").select("id, chat_id, user_id, role, created_at").eq("id", data.messageId).maybeSingle();
    if (!msg || msg.user_id !== user.id || msg.role !== "user") return { ok: false, message: "No encontramos ese mensaje." };

    // Como en ChatGPT: lo que venía después del mensaje editado se descarta y se responde de nuevo.
    await db.from("messages").delete().eq("chat_id", msg.chat_id).gt("created_at", msg.created_at);
    const { data: updated } = await db
      .from("messages")
      .update({ contenido: data.texto, herramienta: data.herramienta })
      .eq("id", msg.id)
      .select("*")
      .single();
    if (!updated) return { ok: false, message: APP_MESSAGES.error };
    const reply = await replyAndSave(db, user.id, msg.chat_id, AIS[data.herramienta], data.texto, via, sub);
    if (!reply) return { ok: false, message: APP_MESSAGES.error };
    return { ok: true, user: updated as ChatMessage, reply };
  });

/** Genera la respuesta de la IA, la guarda y actualiza el chat. */
async function replyAndSave(db: Db, userId: string, chatId: string, ai: Ai, texto: string, via: Via, sub: Suscripcion): Promise<ChatMessage | null> {
  const { tokens = 0, ...reply } = await answer(db, userId, chatId, ai, texto);
  const ok = reply.tipo !== "aviso"; // los avisos no gastan prueba ni tokens
  const { data } = await db
    .from("messages")
    .insert({ chat_id: chatId, user_id: userId, role: "model", herramienta: ai.id, ...reply, acceso: ok ? via : null, tokens: ok ? tokens : null })
    .select("*")
    .single();
  if (ok && via === "tokens") {
    await db.from("suscripciones").update({ tokens: Math.max(0, sub.tokens - tokens) }).eq("user_id", userId);
  }
  await db.from("chats").update({ herramienta: ai.id }).eq("id", chatId); // también actualiza updated_at
  return (data as ChatMessage | null) ?? null;
}

type Reply = { tipo: "texto" | "imagen" | "aviso"; contenido: string; imagen_url?: string | null; tokens?: number };

async function answer(db: Db, userId: string, chatId: string, ai: Ai, texto: string): Promise<Reply> {
  const aviso = (contenido: string): Reply => ({ tipo: "aviso", contenido });
  const gen = await import("./ai.server");

  if (ai.tipo === "imagen") {
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
    const img = await gen.generateImage(texto, history, ai);
    if (!img.ok) return aviso(img.blocked ? APP_MESSAGES.bloqueado : img.busy ? APP_MESSAGES.ocupado : APP_MESSAGES.error);
    if (img.kind === "texto") return { tipo: "texto", contenido: img.text, tokens: img.tokens };
    const ext = img.mime.includes("png") ? "png" : img.mime.includes("webp") ? "webp" : "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from("chat-images").upload(path, img.bytes, { contentType: img.mime });
    if (error) {
      console.error("No se pudo guardar la imagen", error);
      return aviso(APP_MESSAGES.error);
    }
    // contenido = prompt final (no se muestra; sirve de contexto para cambios posteriores)
    return { tipo: "imagen", contenido: img.prompt, imagen_url: db.storage.from("chat-images").getPublicUrl(path).data.publicUrl, tokens: img.tokens + IMAGE_TOKENS };
  }

  const [mine, all] = await Promise.all([usage(db, "texto", userId), usage(db, "texto")]);
  if (mine >= APP_LIMITS.textoPorUsuario || all >= APP_LIMITS.textoGlobal) return aviso(APP_MESSAGES.limiteTexto);
  // Historial del chat (solo texto), del más antiguo al más reciente; el último es el mensaje del usuario.
  const { data: rows } = await db
    .from("messages")
    .select("role, tipo, contenido")
    .eq("chat_id", chatId)
    .eq("tipo", "texto")
    .order("created_at", { ascending: false })
    .limit(HISTORY_TURNS);
  const turns = (rows ?? []).reverse().map((r) => ({ role: r.role as "user" | "model", text: r.contenido }));
  while (turns.length && turns[0]!.role !== "user") turns.shift(); // Gemini exige empezar con el usuario
  const res = await gen.generateText(ai.prompt + identityRule(ai.nombre), turns.length ? turns : [{ role: "user", text: texto }], { maxOutputTokens: 1500 });
  if (!res.ok) return aviso(res.busy ? APP_MESSAGES.ocupado : APP_MESSAGES.error);
  return { tipo: "texto", contenido: res.text, tokens: res.tokens };
}

// ---------- Datos iniciales, plan y match ----------

export const getAppInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const [sub, texto, imagen, usadas, accesos] = await Promise.all([
        getSub(db, user.id),
        usage(db, "texto", user.id),
        usage(db, "imagen", user.id),
        pruebasUsadas(db, user.id),
        accesosActivos(db, user.id),
      ]);
      const diarias = sub ? PLANS[sub.plan].pruebasDiarias : 0;
      const pruebas = Object.fromEntries(AI_IDS.map((id) => [id, Math.max(0, diarias - (usadas[id] ?? 0))])) as Record<AiId, number>;
      return {
        ok: true as const,
        suscripcion: sub,
        restantes: { texto: Math.max(0, APP_LIMITS.textoPorUsuario - texto), imagen: Math.max(0, APP_LIMITS.imagenPorUsuario - imagen) },
        pruebas,
        accesos,
      };
    } catch {
      return { ok: false as const };
    }
  });

/** Activa el plan "comprado" (el pago simulado ya se aprobó en el navegador). No cambia un plan existente. */
export const activarSuscripcion = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, plan: z.enum(["Explorador", "Comparador"]) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const existing = await getSub(db, user.id);
      if (existing) return { ok: true as const, suscripcion: existing };
      const { error } = await db.from("suscripciones").insert({ user_id: user.id, plan: data.plan, ias: [] });
      if (error) return { ok: false as const };
      const usd = Number(PLANS[data.plan].precio.replace(/[^\d.]/g, ""));
      await db.from("compras").insert({ user_id: user.id, tipo: "plan", detalle: data.plan, precio_cop: Math.round(usd * USD_TO_COP) });
      return { ok: true as const, suscripcion: { plan: data.plan, ias: [], tokens: 0 } as Suscripcion };
    } catch {
      return { ok: false as const };
    }
  });

/** Guarda el resultado del test de match: el servidor calcula el top 3 o top 7 según el plan. Solo se hace una vez. */
export const guardarMatch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, respuestas: z.array(z.array(z.number().int().min(0).max(20)).max(5)).length(MATCH_QUIZ.length) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const sub = await getSub(db, user.id);
      if (!sub) return { ok: false as const };
      if (sub.ias.length) return { ok: true as const, suscripcion: sub };
      if (!validAnswers(data.respuestas)) return { ok: false as const };
      const ias = topAis(data.respuestas, PLANS[sub.plan].ias).map((r) => r.id);
      const { error } = await db.from("suscripciones").update({ ias, respuestas: data.respuestas }).eq("user_id", user.id);
      if (error) return { ok: false as const };
      return { ok: true as const, suscripcion: { ...sub, ias } as Suscripcion };
    } catch {
      return { ok: false as const };
    }
  });

// ---------- Proyectos ----------

/** Crea un proyecto con los chats elegidos; el nombre lo propone la IA según el contexto (luego se puede editar). */
export const crearProyecto = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, chatIds: z.array(z.string().uuid()).min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const { data: chats } = await db.from("chats").select("id, titulo").eq("user_id", user.id).in("id", data.chatIds);
      if (!chats?.length) return { ok: false as const };
      const ids = chats.map((c) => c.id);
      const { data: firsts } = await db
        .from("messages")
        .select("chat_id, contenido")
        .in("chat_id", ids)
        .eq("role", "user")
        .order("created_at", { ascending: true })
        .limit(40);
      const context = chats
        .map((c) => `- ${c.titulo}: ${(firsts ?? []).find((m) => m.chat_id === c.id)?.contenido.slice(0, 200) ?? ""}`)
        .join("\n");
      const { generateText } = await import("./ai.server");
      const r = await generateText(
        "Propón un nombre corto (2 a 5 palabras, en español, sin comillas ni punto final) para una carpeta que agrupa estos chats según su tema en común. Responde solo con el nombre.",
        [{ role: "user", text: context }],
        { maxOutputTokens: 30 },
      );
      const nombre = (r.ok ? r.text.replace(/["“”*.]/g, "").split("\n")[0]!.trim() : "") || "Nuevo proyecto";
      const { data: project, error } = await db.from("projects").insert({ user_id: user.id, nombre: nombre.slice(0, 60) }).select("id, nombre, created_at").single();
      if (error || !project) return { ok: false as const };
      await db.from("chats").update({ project_id: project.id }).in("id", ids).eq("user_id", user.id);
      return { ok: true as const, project, chatIds: ids };
    } catch {
      return { ok: false as const };
    }
  });

// ---------- Compras simuladas para IAs fuera del plan ----------

/** Acceso mensual a una IA (se suma a los días que queden). El pago simulado ya se aprobó en el navegador. */
export const comprarMes = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, ia: aiId }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const sub = await getSub(db, user.id);
      if (!sub || sub.ias.includes(data.ia)) return { ok: false as const };
      const actual = (await accesosActivos(db, user.id))[data.ia];
      const desde = actual ? new Date(actual).getTime() : Date.now();
      const hasta = new Date(desde + MES_DIAS * 24 * 3600 * 1000).toISOString();
      const { error } = await db.from("accesos").upsert({ user_id: user.id, ia: data.ia, hasta }, { onConflict: "user_id,ia" });
      if (error) return { ok: false as const };
      await db.from("compras").insert({ user_id: user.id, tipo: "mes", detalle: data.ia, precio_cop: MES_COP });
      return { ok: true as const, hasta };
    } catch {
      return { ok: false as const };
    }
  });

/** Recarga de tokens (sirven para cualquier IA fuera del plan). */
export const comprarTokens = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, paquete: z.enum(TOKEN_PACKS.map((p) => p.id) as [string, ...string[]]) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const sub = await getSub(db, user.id);
      const pack = TOKEN_PACKS.find((p) => p.id === data.paquete);
      if (!sub || !pack) return { ok: false as const };
      const tokens = sub.tokens + pack.tokens;
      const { error } = await db.from("suscripciones").update({ tokens }).eq("user_id", user.id);
      if (error) return { ok: false as const };
      await db.from("compras").insert({ user_id: user.id, tipo: "tokens", detalle: pack.id, precio_cop: pack.cop });
      return { ok: true as const, tokens };
    } catch {
      return { ok: false as const };
    }
  });
