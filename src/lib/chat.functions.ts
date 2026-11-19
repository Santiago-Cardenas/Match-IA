import { createServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

import { APP_LIMITS, APP_MESSAGES, HISTORY_TURNS, MAX_MESSAGE_CHARS } from "./app-config";
import { AIS, AI_IDS, aiIdsOf, identityRule, mixRule, toAiId, toMix, type Ai, type AiId, type Mix } from "./ais";
import { EMPRESA_QUIZ, MATCH_QUIZ, ajustarMatch, rankAis, rankEmpresa, resumenTest, validAnswers, type MatchActual, type MatchAnswers, type Votos } from "./match-quiz";
import { IMAGE_TOKENS, MES_COP, MES_DIAS, PLANS, TOKEN_PACKS, type PlanId } from "./plans";

export type ChatMessage = {
  id: string;
  role: "user" | "model";
  tipo: "texto" | "imagen" | "aviso" | "mix";
  contenido: string;
  imagen_url: string | null;
  /** Mix: prompt que la IA de texto le pasó a la IA de imagen (interno, no se muestra). */
  imagen_prompt?: string | null;
  herramienta: string | null;
  /** Pulgar arriba (1) o abajo (-1) del usuario. */
  voto?: number | null;
  created_at: string;
};

export type Suscripcion = { plan: PlanId; ias: AiId[]; tokens: number };
/** Empresa de la cuenta. ias = recomendadas por el test de la empresa; cuentas = afiliadas (incluye invitaciones pendientes). */
export type Empresa = { id: string; nombre: string; plan: PlanId; rol: "admin" | "miembro"; testHecho: boolean; ias: AiId[]; cuentas: number; descripcion: string | null };
export type Cuenta = { email: string; nombre: string | null; rol: "admin" | "miembro"; activa: boolean; testHecho: boolean };
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
  return { plan: data.plan as PlanId, ias: toAiIds(data.ias), tokens: data.tokens ?? 0 };
}

const toAiIds = (ias: string[]) => ias.map(toAiId).filter((x): x is AiId => !!x);

/**
 * Empresa de la cuenta. Si su correo fue afiliado por una empresa y aún no estaba unida, la une aquí
 * y le crea la suscripción con el plan de la empresa (no paga nada: el pack ya lo pagó la empresa).
 */
async function miEmpresa(db: Db, user: User): Promise<(Empresa & { respuestas: MatchAnswers | null }) | null> {
  let { data: m } = await db.from("miembros").select("empresa_id, rol").eq("user_id", user.id).maybeSingle();
  if (!m && user.email) {
    const nombre = String(user.user_metadata?.["nombre"] ?? "").trim() || null;
    ({ data: m } = await db
      .from("miembros")
      .update({ user_id: user.id, nombre })
      .eq("email", user.email.toLowerCase())
      .is("user_id", null)
      .select("empresa_id, rol")
      .maybeSingle());
  }
  if (!m) return null;
  const [{ data: e }, { count }] = await Promise.all([
    db.from("empresas").select("id, nombre, plan, respuestas, ias, descripcion").eq("id", m.empresa_id).single(),
    db.from("miembros").select("email", { count: "exact", head: true }).eq("empresa_id", m.empresa_id),
  ]);
  if (!e) return null;
  if (!(await getSub(db, user.id))) await db.from("suscripciones").insert({ user_id: user.id, plan: e.plan, ias: [] });
  return {
    id: e.id,
    nombre: e.nombre,
    plan: e.plan as PlanId,
    rol: m.rol as Empresa["rol"],
    testHecho: !!e.respuestas,
    ias: toAiIds(e.ias),
    cuentas: count ?? 1,
    descripcion: e.descripcion,
    respuestas: (e.respuestas as MatchAnswers | null) ?? null,
  };
}

/**
 * Memoria global: lo que todas las IAs saben de la persona y de su empresa en cualquier chat, sin que se lo repitan.
 * Sale de los dos tests, la descripción de la empresa (la escribe la cuenta administradora) y la nota personal.
 */
async function memoriaGlobal(db: Db, user: User) {
  const [empresa, { data: sub }] = await Promise.all([miEmpresa(db, user), db.from("suscripciones").select("respuestas, memoria").eq("user_id", user.id).maybeSingle()]);
  const lineas: string[] = [];
  const nombre = String(user.user_metadata?.["nombre"] ?? "").trim();
  if (nombre) lineas.push(`Se llama ${nombre}.`);
  if (empresa) {
    lineas.push(`Trabaja en la empresa "${empresa.nombre}"${empresa.rol === "admin" ? " y administra su cuenta en Matchia" : ""}.`);
    if (empresa.descripcion) lineas.push(`Qué hace la empresa: ${empresa.descripcion}`);
    lineas.push(...resumenTest(empresa.respuestas, EMPRESA_QUIZ).map((l) => `Test de la empresa · ${l}`));
  }
  lineas.push(...resumenTest(sub?.respuestas, MATCH_QUIZ).map((l) => `Test personal · ${l}`));
  if (sub?.memoria) lineas.push(`Lo que la persona quiere que sepas: ${sub.memoria}`);
  if (!lineas.length) return "";
  return `\n\nMemoria de Matchia sobre quien te escribe. Ya lo sabes: úsalo para personalizar tus respuestas (nombre de la empresa, a qué se dedica, su público) sin pedirle que lo repita. No lo recites ni lo menciones si no viene al caso; si el chat dice otra cosa, manda el chat.\n- ${lineas.join("\n- ")}`;
}

const publica = ({ respuestas: _, ...e }: Empresa & { respuestas: unknown }): Empresa => e;

const since24h = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString();

/** Prompts de prueba usados en las últimas 24 h, por IA. En un Mix cada IA cuenta según su parte de acceso ("plan+prueba"). */
async function pruebasUsadas(db: Db, userId: string) {
  const { data } = await db.from("messages").select("herramienta, acceso").eq("user_id", userId).eq("role", "model").like("acceso", "%prueba%").gte("created_at", since24h());
  const out: Partial<Record<AiId, number>> = {};
  for (const r of data ?? []) {
    const vias = (r.acceso ?? "").split("+");
    aiIdsOf(r.herramienta).forEach((id, i) => {
      if (vias[i] === "prueba") out[id] = (out[id] ?? 0) + 1;
    });
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

/** Respuestas exitosas de la IA en las últimas 24 h (los avisos y errores no cuentan). Un Mix cuenta como texto y como imagen. */
async function usage(db: Db, tipo: "texto" | "imagen", userId?: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  let q = db.from("messages").select("id", { count: "exact", head: true }).eq("role", "model").gte("created_at", since);
  q = tipo === "texto" ? q.in("tipo", ["texto", "mix"]) : q.or("tipo.eq.imagen,and(tipo.eq.mix,imagen_url.not.is.null)");
  if (userId) q = q.eq("user_id", userId);
  const { count } = await q;
  return count ?? 0;
}

const token = z.string().min(10).max(4000);
const aiId = z.enum(AI_IDS as [AiId, ...AiId[]]);
/** Una IA ("jasper") o un Mix ("jasper+midjourney"). */
const herramienta = z.string().max(40).refine((v) => v in AIS || !!toMix(v));

/** Cómo accede la cuenta a cada IA de la herramienta; si alguna está bloqueada, la devuelve para ofrecer desbloquearla. */
async function resolveTool(db: Db, userId: string, sub: Suscripcion, tool: string): Promise<{ vias: Via[] } | { bloqueada: AiId }> {
  const vias: Via[] = [];
  for (const id of aiIdsOf(tool)) {
    const via = await resolveAccess(db, userId, sub, id);
    if (!via) return { bloqueada: id };
    vias.push(via);
  }
  return { vias };
}

export type SendResult =
  | { ok: true; chatId: string; titulo: string; user: ChatMessage; reply: ChatMessage }
  | { ok: false; message: string; bloqueada?: AiId };

// ---------- Enviar un mensaje ----------

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, chatId: z.string().uuid().nullable(), herramienta, texto: z.string().trim().min(1).max(MAX_MESSAGE_CHARS) }).parse(d))
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
    const acceso = await resolveTool(db, user.id, sub, data.herramienta);
    if ("bloqueada" in acceso) return { ok: false, message: BLOQUEADA, bloqueada: acceso.bloqueada };

    // Chat existente (del mismo usuario) o uno nuevo con el inicio del mensaje como título.
    let chatId = data.chatId;
    let titulo = "";
    if (chatId) {
      const { data: chat } = await db.from("chats").select("id, titulo, user_id").eq("id", chatId).maybeSingle();
      if (!chat || chat.user_id !== user.id) return { ok: false, message: "No encontramos ese chat." };
      titulo = chat.titulo;
    } else {
      titulo = data.texto.replace(/\s+/g, " ").slice(0, 60);
      const { data: chat, error } = await db.from("chats").insert({ user_id: user.id, titulo, herramienta: data.herramienta }).select("id").single();
      if (error || !chat) return { ok: false, message: APP_MESSAGES.error };
      chatId = chat.id;
    }

    const { data: userMsg, error: userErr } = await db
      .from("messages")
      .insert({ chat_id: chatId, user_id: user.id, role: "user", tipo: "texto", contenido: data.texto, herramienta: data.herramienta })
      .select("*")
      .single();
    if (userErr || !userMsg) return { ok: false, message: APP_MESSAGES.error };

    const reply = await replyAndSave(db, user, chatId, data.herramienta, data.texto, acceso.vias, sub);
    if (!reply) return { ok: false, message: APP_MESSAGES.error };
    return { ok: true, chatId, titulo, user: userMsg as ChatMessage, reply };
  });

// ---------- Editar un mensaje ya enviado y reenviarlo ----------

export type EditResult = { ok: true; user: ChatMessage; reply: ChatMessage } | { ok: false; message: string; bloqueada?: AiId };

export const editAndResend = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, messageId: z.string().uuid(), herramienta, texto: z.string().trim().min(1).max(MAX_MESSAGE_CHARS) }).parse(d))
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
    const acceso = await resolveTool(db, user.id, sub, data.herramienta);
    if ("bloqueada" in acceso) return { ok: false, message: BLOQUEADA, bloqueada: acceso.bloqueada };
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
    const reply = await replyAndSave(db, user, msg.chat_id, data.herramienta, data.texto, acceso.vias, sub);
    if (!reply) return { ok: false, message: APP_MESSAGES.error };
    return { ok: true, user: updated as ChatMessage, reply };
  });

/**
 * Genera la respuesta (de una IA o de un Mix), la guarda y actualiza el chat.
 * vias = acceso de cada IA de la herramienta; gasto = tokens de cada parte que sí respondió.
 */
async function replyAndSave(db: Db, user: User, chatId: string, tool: string, texto: string, vias: Via[], sub: Suscripcion): Promise<ChatMessage | null> {
  const userId = user.id;
  const memoria = await memoriaGlobal(db, user);
  const mix = toMix(tool);
  const { gasto = [], ...reply } = mix ? await answerMix(db, userId, chatId, mix, texto, memoria) : await answer(db, userId, chatId, AIS[tool as AiId], texto, memoria);
  const ok = reply.tipo !== "aviso"; // los avisos no gastan prueba ni tokens
  const { data } = await db
    .from("messages")
    .insert({
      chat_id: chatId,
      user_id: userId,
      role: "model",
      herramienta: tool,
      ...reply,
      acceso: ok ? vias.slice(0, gasto.length).join("+") : null, // si la imagen de un Mix falló, no gasta su prueba
      tokens: ok ? gasto.reduce((a, b) => a + b, 0) : null,
    })
    .select("*")
    .single();
  const cobrar = gasto.reduce((a, t, i) => a + (vias[i] === "tokens" ? t : 0), 0);
  if (ok && cobrar) {
    await db.from("suscripciones").update({ tokens: Math.max(0, sub.tokens - cobrar) }).eq("user_id", userId);
  }
  await db.from("chats").update({ herramienta: tool }).eq("id", chatId); // también actualiza updated_at
  return (data as ChatMessage | null) ?? null;
}

type Reply = { tipo: "texto" | "imagen" | "aviso" | "mix"; contenido: string; imagen_url?: string | null; imagen_prompt?: string | null; gasto?: number[] };

/** Historial de texto del chat, del más antiguo al más reciente; el último es el mensaje del usuario. */
async function textTurns(db: Db, chatId: string, texto: string) {
  const { data: rows } = await db
    .from("messages")
    .select("role, tipo, contenido")
    .eq("chat_id", chatId)
    .in("tipo", ["texto", "mix"])
    .order("created_at", { ascending: false })
    .limit(HISTORY_TURNS);
  const turns = (rows ?? []).reverse().map((r) => ({ role: r.role as "user" | "model", text: r.contenido }));
  while (turns.length && turns[0]!.role !== "user") turns.shift(); // Gemini exige empezar con el usuario
  return turns.length ? turns : [{ role: "user" as const, text: texto }];
}

/** Sube la imagen generada al bucket y devuelve su URL pública. */
async function saveImage(db: Db, userId: string, bytes: Uint8Array, mime: string) {
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from("chat-images").upload(path, bytes, { contentType: mime });
  if (error) {
    console.error("No se pudo guardar la imagen", error);
    return null;
  }
  return db.storage.from("chat-images").getPublicUrl(path).data.publicUrl;
}

async function answer(db: Db, userId: string, chatId: string, ai: Ai, texto: string, memoria: string): Promise<Reply> {
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
    const img = await gen.generateImage(texto, history, ai, { memoria });
    if (!img.ok) return aviso(img.blocked ? APP_MESSAGES.bloqueado : img.busy ? APP_MESSAGES.ocupado : APP_MESSAGES.error);
    if (img.kind === "texto") return { tipo: "texto", contenido: img.text, gasto: [img.tokens] };
    const url = await saveImage(db, userId, img.bytes, img.mime);
    if (!url) return aviso(APP_MESSAGES.error);
    // contenido = prompt final (no se muestra; sirve de contexto para cambios posteriores)
    return { tipo: "imagen", contenido: img.prompt, imagen_url: url, gasto: [img.tokens + IMAGE_TOKENS] };
  }

  const [mine, all] = await Promise.all([usage(db, "texto", userId), usage(db, "texto")]);
  if (mine >= APP_LIMITS.textoPorUsuario || all >= APP_LIMITS.textoGlobal) return aviso(APP_MESSAGES.limiteTexto);
  const res = await gen.generateText(ai.prompt + identityRule(ai.nombre) + memoria, await textTurns(db, chatId, texto), { maxOutputTokens: 1500 });
  if (!res.ok) return aviso(res.busy ? APP_MESSAGES.ocupado : APP_MESSAGES.error);
  return { tipo: "texto", contenido: res.text, gasto: [res.tokens] };
}

/**
 * Mix: en una sola respuesta, la IA de texto escribe el contenido listo para copiar y el prompt de la imagen
 * acompañante; ese prompt pasa internamente por el filtro de la IA de imagen y se genera la imagen.
 * Si la imagen falla, se entrega el texto igual (sin cobrar la parte de la imagen).
 */
async function answerMix(db: Db, userId: string, chatId: string, mix: Mix, texto: string, memoria: string): Promise<Reply> {
  const aviso = (contenido: string): Reply => ({ tipo: "aviso", contenido });
  const escritor = AIS[mix.texto];
  const ilustrador = AIS[mix.imagen];
  const [textoMio, textoTodos, imagenMia, imagenTodas] = await Promise.all([usage(db, "texto", userId), usage(db, "texto"), usage(db, "imagen", userId), usage(db, "imagen")]);
  if (textoMio >= APP_LIMITS.textoPorUsuario || textoTodos >= APP_LIMITS.textoGlobal) return aviso(APP_MESSAGES.limiteTexto);
  if (imagenMia >= APP_LIMITS.imagenPorUsuario || imagenTodas >= APP_LIMITS.imagenGlobal) return aviso(APP_MESSAGES.limiteImagen);

  const gen = await import("./ai.server");
  const res = await gen.generateText(escritor.prompt + identityRule(escritor.nombre) + mixRule(ilustrador) + memoria, await textTurns(db, chatId, texto), { maxOutputTokens: 1800, json: true });
  if (!res.ok) return aviso(res.busy ? APP_MESSAGES.ocupado : APP_MESSAGES.error);
  let parte: { texto?: unknown; imagen?: unknown } = {};
  try {
    parte = JSON.parse(res.text.replace(/^```(?:json)?|```$/g, "").trim()) as typeof parte;
  } catch {
    console.error("Mix: la respuesta de texto no es JSON", res.text.slice(0, 200));
  }
  const contenido = typeof parte.texto === "string" && parte.texto.trim() ? parte.texto.trim() : res.text;
  const prompt = typeof parte.imagen === "string" ? parte.imagen.trim() : "";
  if (!prompt) return { tipo: "mix", contenido, imagen_prompt: null, gasto: [res.tokens] };

  const img = await gen.generateImage(prompt, [], ilustrador, { soloImagen: true, memoria });
  const url = img.ok && img.kind === "imagen" ? await saveImage(db, userId, img.bytes, img.mime) : null;
  if (!url || !img.ok || img.kind !== "imagen") return { tipo: "mix", contenido, imagen_prompt: prompt, gasto: [res.tokens] };
  return { tipo: "mix", contenido, imagen_url: url, imagen_prompt: prompt, gasto: [res.tokens, img.tokens + IMAGE_TOKENS] };
}

// ---------- Votos y "Tu match" ----------

/** Pulgar arriba (1), abajo (-1) o quitar el voto (0) sobre una respuesta de la IA. */
export const votarRespuesta = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, messageId: z.string().uuid(), voto: z.union([z.literal(-1), z.literal(0), z.literal(1)]) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const { error } = await db
        .from("messages")
        .update({ voto: data.voto || null })
        .eq("id", data.messageId)
        .eq("user_id", user.id)
        .eq("role", "model")
        .neq("tipo", "aviso");
      return { ok: !error };
    } catch {
      return { ok: false };
    }
  });

/**
 * "Tu match": el % de cada IA según el test inicial (combinado con el de la empresa), ajustado con los votos.
 * En un Mix, el voto cuenta para las dos IAs.
 */
export const getMiMatch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; match: MatchActual[]; votos: number } | { ok: false }> => {
    try {
      const { db, user } = await requireUser(data.token);
      const [{ data: sub }, empresa, { data: rows }] = await Promise.all([
        db.from("suscripciones").select("ias, respuestas").eq("user_id", user.id).maybeSingle(),
        miEmpresa(db, user),
        db.from("messages").select("herramienta, voto").eq("user_id", user.id).not("voto", "is", null).limit(5000),
      ]);
      if (!sub) return { ok: false };
      const respuestas = sub.respuestas as MatchAnswers | null;
      // Cuentas sin respuestas guardadas (creadas antes del test): parten de las IAs de su plan.
      const inicial =
        respuestas && validAnswers(respuestas)
          ? rankAis(respuestas, empresa?.respuestas)
          : AI_IDS.map((id) => ({ id, pct: sub.ias.includes(id) ? 80 : 60 }));
      const votos: Votos = {};
      for (const r of rows ?? []) {
        for (const id of aiIdsOf(r.herramienta)) {
          const v = (votos[id] ??= { up: 0, down: 0 });
          if (r.voto === 1) v.up++;
          else v.down++;
        }
      }
      return { ok: true, match: ajustarMatch(inicial, votos), votos: rows?.length ?? 0 };
    } catch {
      return { ok: false };
    }
  });

// ---------- Datos iniciales, plan y match ----------

export const getAppInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const empresa = await miEmpresa(db, user); // antes que getSub: puede crear la suscripción de una cuenta afiliada
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
        empresa: empresa && publica(empresa),
        restantes: { texto: Math.max(0, APP_LIMITS.textoPorUsuario - texto), imagen: Math.max(0, APP_LIMITS.imagenPorUsuario - imagen) },
        pruebas,
        accesos,
      };
    } catch {
      return { ok: false as const };
    }
  });

/**
 * Registra la empresa que "compró" el pack (el pago simulado ya se aprobó en el navegador): crea la empresa,
 * deja a la cuenta como administradora y activa su plan. Si la cuenta ya pertenece a una empresa, no cambia nada.
 */
export const activarSuscripcion = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, plan: z.enum(["Explorador", "Comparador"]), empresa: z.string().trim().min(2).max(100) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const actual = await miEmpresa(db, user);
      const sub = actual && (await getSub(db, user.id));
      if (actual && sub) return { ok: true as const, suscripcion: sub, empresa: publica(actual) };
      if (!user.email) return { ok: false as const };
      const { data: e, error } = await db.from("empresas").insert({ nombre: data.empresa, plan: data.plan, admin_id: user.id }).select("id").single();
      if (error || !e) return { ok: false as const };
      const nombre = String(user.user_metadata?.["nombre"] ?? "").trim() || null;
      const { error: mErr } = await db.from("miembros").insert({ empresa_id: e.id, email: user.email.toLowerCase(), user_id: user.id, nombre, rol: "admin" });
      if (mErr) {
        await db.from("empresas").delete().eq("id", e.id);
        return { ok: false as const };
      }
      await db.from("compras").insert({ user_id: user.id, tipo: "plan", detalle: data.plan, precio_cop: PLANS[data.plan].precioCop });
      const empresa = await miEmpresa(db, user); // también crea la suscripción
      const nueva = await getSub(db, user.id);
      if (!empresa || !nueva) return { ok: false as const };
      return { ok: true as const, suscripcion: nueva, empresa: publica(empresa) };
    } catch {
      return { ok: false as const };
    }
  });

const respuestasSchema = (n: number) => z.array(z.array(z.number().int().min(0).max(20)).max(5)).length(n);
type Pcts = Partial<Record<AiId, number>>;

/** Test de la empresa: lo hace la cuenta administradora, una sola vez. Define las IAs recomendadas para la empresa. */
export const guardarTestEmpresa = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, respuestas: respuestasSchema(EMPRESA_QUIZ.length) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const empresa = await miEmpresa(db, user);
      if (!empresa || empresa.rol !== "admin") return { ok: false as const };
      if (empresa.testHecho) return { ok: true as const, empresa: publica(empresa), pcts: {} as Pcts };
      if (!validAnswers(data.respuestas, EMPRESA_QUIZ)) return { ok: false as const };
      const ranking = rankEmpresa(data.respuestas).slice(0, PLANS[empresa.plan].ias);
      const ias = ranking.map((r) => r.id);
      const { error } = await db.from("empresas").update({ respuestas: data.respuestas, ias }).eq("id", empresa.id);
      if (error) return { ok: false as const };
      return { ok: true as const, empresa: { ...publica(empresa), testHecho: true, ias }, pcts: Object.fromEntries(ranking.map((r) => [r.id, r.pct])) as Pcts };
    } catch {
      return { ok: false as const };
    }
  });

/**
 * Test de match de cada cuenta: el servidor calcula el top 3 o top 7 según el plan, combinando las respuestas
 * de la persona con las del test de su empresa. Solo se hace una vez.
 */
export const guardarMatch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, respuestas: respuestasSchema(MATCH_QUIZ.length) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const empresa = await miEmpresa(db, user);
      const sub = await getSub(db, user.id);
      if (!sub || !empresa) return { ok: false as const };
      if (sub.ias.length) return { ok: true as const, suscripcion: sub, pcts: {} as Pcts };
      if (!validAnswers(data.respuestas)) return { ok: false as const };
      const ranking = rankAis(data.respuestas, empresa.respuestas).slice(0, PLANS[sub.plan].ias);
      const ias = ranking.map((r) => r.id);
      const { error } = await db.from("suscripciones").update({ ias, respuestas: data.respuestas }).eq("user_id", user.id);
      if (error) return { ok: false as const };
      return { ok: true as const, suscripcion: { ...sub, ias } as Suscripcion, pcts: Object.fromEntries(ranking.map((r) => [r.id, r.pct])) as Pcts };
    } catch {
      return { ok: false as const };
    }
  });

// ---------- Empresa: perfil y cuentas afiliadas ----------

async function listarCuentas(db: Db, empresaId: string): Promise<Cuenta[]> {
  const { data: rows } = await db.from("miembros").select("email, nombre, rol, user_id, created_at").eq("empresa_id", empresaId).order("created_at", { ascending: true });
  const ids = (rows ?? []).map((r) => r.user_id).filter((x): x is string => !!x);
  const { data: subs } = ids.length ? await db.from("suscripciones").select("user_id, ias").in("user_id", ids) : { data: [] };
  const conTest = new Set((subs ?? []).filter((x) => x.ias.length).map((x) => x.user_id));
  return (rows ?? []).map((r) => ({ email: r.email, nombre: r.nombre, rol: r.rol as Cuenta["rol"], activa: !!r.user_id, testHecho: !!r.user_id && conTest.has(r.user_id) }));
}

/** Perfil de la empresa. La lista de cuentas solo la ve la cuenta administradora. */
export const getEmpresa = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const empresa = await miEmpresa(db, user);
      if (!empresa) return { ok: false as const };
      const { data: sub } = await db.from("suscripciones").select("memoria").eq("user_id", user.id).maybeSingle();
      return { ok: true as const, empresa: publica(empresa), cuentas: empresa.rol === "admin" ? await listarCuentas(db, empresa.id) : [], memoria: sub?.memoria ?? "" };
    } catch {
      return { ok: false as const };
    }
  });

const nota = z.string().trim().max(1000);

/** Memoria global: la descripción de la empresa (solo la cuenta administradora) y la nota personal de cada cuenta. */
export const guardarMemoria = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, descripcion: nota.optional(), memoria: nota.optional() }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { db, user } = await requireUser(data.token);
      const empresa = await miEmpresa(db, user);
      if (!empresa) return { ok: false as const };
      if (data.descripcion !== undefined) {
        if (empresa.rol !== "admin") return { ok: false as const };
        const { error } = await db.from("empresas").update({ descripcion: data.descripcion || null }).eq("id", empresa.id);
        if (error) return { ok: false as const };
      }
      if (data.memoria !== undefined) {
        const { error } = await db.from("suscripciones").update({ memoria: data.memoria || null }).eq("user_id", user.id);
        if (error) return { ok: false as const };
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

const email = z.string().trim().toLowerCase().email().max(255);
type CuentasResult = { ok: true; cuentas: Cuenta[] } | { ok: false; message: string };

/** La empresa afilia una cuenta por correo; la persona entra a Matchia creando su cuenta con ese correo. */
export const afiliarCuenta = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, email }).parse(d))
  .handler(async ({ data }): Promise<CuentasResult> => {
    try {
      const { db, user } = await requireUser(data.token);
      const empresa = await miEmpresa(db, user);
      if (!empresa || empresa.rol !== "admin") return { ok: false, message: "Solo la cuenta administradora puede afiliar cuentas." };
      const max = PLANS[empresa.plan].cuentas;
      if (empresa.cuentas >= max) return { ok: false, message: `Tu Pack ${empresa.plan} incluye hasta ${max} cuentas y ya las usaste.` };
      const { error } = await db.from("miembros").insert({ empresa_id: empresa.id, email: data.email, rol: "miembro" });
      if (error) return { ok: false, message: error.code === "23505" ? "Ese correo ya está afiliado a una empresa en Matchia." : "No pudimos afiliar la cuenta. Intenta de nuevo." };
      return { ok: true, cuentas: await listarCuentas(db, empresa.id) };
    } catch {
      return { ok: false, message: "No pudimos afiliar la cuenta. Intenta de nuevo." };
    }
  });

/** Quita una cuenta de la empresa y libera el cupo. Si ya estaba activa, pierde el acceso a las IAs del plan. */
export const quitarCuenta = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, email }).parse(d))
  .handler(async ({ data }): Promise<CuentasResult> => {
    try {
      const { db, user } = await requireUser(data.token);
      const empresa = await miEmpresa(db, user);
      if (!empresa || empresa.rol !== "admin") return { ok: false, message: "Solo la cuenta administradora puede quitar cuentas." };
      const { data: quitada } = await db.from("miembros").delete().eq("empresa_id", empresa.id).eq("email", data.email).eq("rol", "miembro").select("user_id").maybeSingle();
      if (quitada?.user_id) await db.from("suscripciones").delete().eq("user_id", quitada.user_id);
      return { ok: true, cuentas: await listarCuentas(db, empresa.id) };
    } catch {
      return { ok: false, message: "No pudimos quitar la cuenta. Intenta de nuevo." };
    }
  });

/** Antes de crear una cuenta afiliada: confirma que el correo tenga una invitación pendiente. */
export const invitacionPendiente = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email }).parse(d))
  .handler(async ({ data }) => {
    try {
      const db = await admin();
      const { data: m } = await db.from("miembros").select("email").eq("email", data.email).is("user_id", null).maybeSingle();
      return { ok: !!m };
    } catch {
      return { ok: false };
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
