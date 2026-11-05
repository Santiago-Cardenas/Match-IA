import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2, Lock, Menu, SquarePen } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { ChatSidebar, type ChatRow, type ProjectRow } from "@/components/chat/chat-sidebar";
import { Composer, type ComposerHandle } from "@/components/chat/composer";
import { MessageList } from "@/components/chat/message-list";
import { ToolPicker, lockedStatus, type AccessInfo } from "@/components/chat/tool-picker";
import { UnlockDialog } from "@/components/chat/unlock-dialog";
import { Onboarding } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { AIS, toAiId, type AiId } from "@/lib/ais";
import { activarSuscripcion, crearProyecto, editAndResend, getAppInfo, sendChatMessage, type ChatMessage, type Suscripcion } from "@/lib/chat.functions";
import { PLANS, isPlan } from "@/lib/plans";
import { useSession } from "@/lib/auth";
import { trackEvent } from "@/lib/tracking";

export const Route = createFileRoute("/app")({
  validateSearch: (s: Record<string, unknown>): { chat?: string | undefined } => ({ chat: typeof s["chat"] === "string" ? s["chat"] : undefined }),
  head: () => ({ meta: [{ title: "Matchia" }, { name: "robots", content: "noindex" }] }),
  component: AppPage,
});

function Loading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
      <Loader2 className="size-6 animate-spin" aria-label="Cargando" />
    </main>
  );
}

function AppPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const infoFn = useServerFn(getAppInfo);
  const activarFn = useServerFn(activarSuscripcion);
  const [sub, setSub] = useState<Suscripcion | null | undefined>(undefined); // undefined = cargando
  const [restantes, setRestantes] = useState<{ texto: number; imagen: number } | null>(null);
  const [access, setAccess] = useState<AccessInfo>({ pruebas: {}, accesos: {}, tokens: 0 });

  // La app usa el tema oscuro de la marca; se aplica al <body> para que los diálogos también lo tomen.
  useEffect(() => {
    document.body.classList.add("app-theme");
    return () => document.body.classList.remove("app-theme");
  }, []);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/entrar" });
  }, [loading, session, navigate]);

  const token = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token ?? session?.access_token ?? "", [session]);

  // Uso del día, pruebas restantes, accesos mensuales y tokens (se vuelve a pedir tras usar IAs fuera del plan o comprar).
  const refresh = useCallback(async () => {
    const res = await infoFn({ data: { token: await token() } });
    if (!res.ok) return null;
    setRestantes(res.restantes);
    setAccess({ pruebas: res.pruebas, accesos: res.accesos, tokens: res.suscripcion?.tokens ?? 0 });
    return res;
  }, [infoFn, token]);

  // Plan. Si pagó al registrarse pero el plan no se activó (p. ej. confirmó el correo después), se activa aquí.
  useEffect(() => {
    if (!session) return;
    void (async () => {
      const res = await refresh();
      if (!res) return setSub(null);
      const pagado = session.user.user_metadata?.["plan"];
      if (!res.suscripcion && isPlan(pagado)) {
        const a = await activarFn({ data: { token: await token(), plan: pagado } });
        return setSub(a.ok ? a.suscripcion : null);
      }
      setSub(res.suscripcion);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  if (!session || sub === undefined) return <Loading />;
  if (!sub || !sub.ias.length) return <Onboarding token={token} suscripcion={sub} onDone={(s) => { setSub(s); void refresh(); }} />;
  return <ChatApp session={session} sub={sub} token={token} restantes={restantes} setRestantes={setRestantes} access={access} refresh={refresh} />;
}

function ChatApp({ session, sub, token, restantes, setRestantes, access, refresh }: {
  session: Session;
  sub: Suscripcion;
  token: () => Promise<string>;
  restantes: { texto: number; imagen: number } | null;
  setRestantes: React.Dispatch<React.SetStateAction<{ texto: number; imagen: number } | null>>;
  access: AccessInfo;
  refresh: () => Promise<unknown>;
}) {
  const { chat: chatId } = Route.useSearch();
  const navigate = useNavigate({ from: "/app" });
  const sendFn = useServerFn(sendChatMessage);
  const editFn = useServerFn(editAndResend);
  const projectFn = useServerFn(crearProyecto);
  const composer = useRef<ComposerHandle>(null);
  const activeChat = useRef<string | undefined>(chatId);
  const skipLoad = useRef<string | null>(null);

  const [chats, setChats] = useState<ChatRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [tool, setTool] = useState<AiId>(sub.ias[0]!);
  const [pending, setPending] = useState<{ herramienta: AiId } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ kind: "chat" | "proyecto"; id: string; nombre: string } | null>(null);

  const user = session.user;
  const userName = String(user.user_metadata?.["nombre"] ?? "").trim();
  const firstName = userName.split(" ")[0];
  const included = (id: AiId | null): id is AiId => !!id && sub.ias.includes(id);

  const loadLists = useCallback(async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("chats").select("id, titulo, herramienta, updated_at, project_id").order("updated_at", { ascending: false }).limit(300),
      supabase.from("projects").select("id, nombre").order("created_at", { ascending: false }),
    ]);
    setChats(c ?? []);
    setProjects(p ?? []);
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  // Mensajes del chat abierto.
  useEffect(() => {
    activeChat.current = chatId;
    if (!chatId) {
      setMessages([]);
      return;
    }
    if (skipLoad.current === chatId) {
      skipLoad.current = null;
      return;
    }
    let cancelled = false;
    setLoadingChat(true);
    void (async () => {
      const [{ data: rows }, { data: chat }] = await Promise.all([
        supabase.from("messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: true }),
        supabase.from("chats").select("herramienta").eq("id", chatId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (!chat) {
        void navigate({ search: {} });
        return;
      }
      setMessages((rows ?? []) as ChatMessage[]);
      const id = toAiId(chat.herramienta);
      if (id) setTool(id);
      setLoadingChat(false);
    })();
    return () => {
      cancelled = true;
      setLoadingChat(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, navigate]);

  function openChat(id?: string) {
    setMenuOpen(false);
    void navigate({ search: id ? { chat: id } : {} });
  }

  function countUse(reply: ChatMessage) {
    const used = reply.tipo === "imagen" ? "imagen" : reply.tipo === "texto" ? "texto" : null;
    if (used) setRestantes((r) => r && { ...r, [used]: Math.max(0, r[used] - 1) });
  }

  const localAviso = (contenido: string): ChatMessage => ({
    id: `aviso-${Date.now()}`, role: "model", tipo: "aviso", contenido, imagen_url: null, herramienta: tool, created_at: new Date().toISOString(),
  });

  async function send(text: string) {
    if (pending) return;
    const herramienta = tool;
    const origin = chatId;
    const temp: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", tipo: "texto", contenido: text, imagen_url: null, herramienta, created_at: new Date().toISOString() };
    setMessages((m) => [...m, temp]);
    setPending({ herramienta });
    void trackEvent("app_mensaje", herramienta);
    try {
      const res = await sendFn({ data: { token: await token(), chatId: origin ?? null, herramienta, texto: text } });
      if (!included(herramienta)) void refresh(); // pruebas y tokens de IAs fuera del plan
      if (activeChat.current !== origin) return void loadLists(); // el usuario cambió de chat mientras esperaba
      if (!res.ok) {
        setMessages((m) => [...m.filter((x) => !(res.bloqueada && x.id === temp.id)), localAviso(res.message)]);
        if (res.bloqueada) setUnlockOpen(true);
        return;
      }
      setMessages((m) => [...m.filter((x) => x.id !== temp.id), res.user, res.reply]);
      countUse(res.reply);
      setChats((cs) => {
        const prev = cs.find((c) => c.id === res.chatId);
        return [{ id: res.chatId, titulo: res.titulo, herramienta, updated_at: new Date().toISOString(), project_id: prev?.project_id ?? null }, ...cs.filter((c) => c.id !== res.chatId)];
      });
      if (!origin) {
        skipLoad.current = res.chatId;
        activeChat.current = res.chatId;
        void navigate({ search: { chat: res.chatId } });
      }
    } catch {
      setMessages((m) => [...m, localAviso("No pudimos enviar tu mensaje. Revisa tu conexión e intenta de nuevo.")]);
    } finally {
      setPending(null);
    }
  }

  // Editar un mensaje enviado: se descarta lo que venía después y la IA responde de nuevo.
  async function edit(messageId: string, text: string) {
    if (pending || !chatId) return;
    const herramienta = tool;
    const origin = chatId;
    setMessages((m) => {
      const i = m.findIndex((x) => x.id === messageId);
      return i < 0 ? m : [...m.slice(0, i), { ...m[i]!, contenido: text }];
    });
    setPending({ herramienta });
    void trackEvent("app_mensaje_editado", herramienta);
    try {
      const res = await editFn({ data: { token: await token(), messageId, herramienta, texto: text } });
      if (!included(herramienta)) void refresh();
      if (activeChat.current !== origin) return;
      if (!res.ok) {
        setMessages((m) => [...m, localAviso(res.message)]);
        if (res.bloqueada) setUnlockOpen(true);
        return;
      }
      setMessages((m) => [...m.filter((x) => x.id !== messageId), res.user, res.reply]);
      countUse(res.reply);
    } catch {
      setMessages((m) => [...m, localAviso("No pudimos reenviar tu mensaje. Intenta de nuevo.")]);
    } finally {
      setPending(null);
    }
  }

  async function renameChat(id: string, titulo: string) {
    setChats((cs) => cs.map((c) => (c.id === id ? { ...c, titulo } : c)));
    await supabase.from("chats").update({ titulo }).eq("id", id);
  }

  async function createProject(chatIds: string[]) {
    const res = await projectFn({ data: { token: await token(), chatIds } });
    if (!res.ok) return;
    setProjects((p) => [{ id: res.project.id, nombre: res.project.nombre }, ...p]);
    setChats((cs) => cs.map((c) => (res.chatIds.includes(c.id) ? { ...c, project_id: res.project.id } : c)));
    void trackEvent("proyecto_creado");
  }

  async function renameProject(id: string, nombre: string) {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, nombre } : p)));
    await supabase.from("projects").update({ nombre }).eq("id", id);
  }

  async function removeFromProject(chatIdToRemove: string) {
    setChats((cs) => cs.map((c) => (c.id === chatIdToRemove ? { ...c, project_id: null } : c)));
    await supabase.from("chats").update({ project_id: null }).eq("id", chatIdToRemove);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const { kind, id } = toDelete;
    setToDelete(null);
    if (kind === "proyecto") {
      setProjects((ps) => ps.filter((p) => p.id !== id));
      setChats((cs) => cs.map((c) => (c.project_id === id ? { ...c, project_id: null } : c)));
      await supabase.from("projects").delete().eq("id", id);
      return;
    }
    setChats((cs) => cs.filter((c) => c.id !== id));
    await supabase.from("chats").delete().eq("id", id);
    if (id === chatId) openChat();
  }

  function chooseSuggestion(id: AiId) {
    setTool(id);
    composer.current?.fill(AIS[id].ejemplo);
  }

  const empty = !chatId && messages.length === 0;
  const isImage = AIS[tool].tipo === "imagen";
  const locked = !included(tool);
  const status = locked ? lockedStatus(tool, access) : null;
  const placeholder = status && !status.usable ? `Desbloquea ${AIS[tool].nombre} para seguir usándola` : AIS[tool].placeholder;
  const composerLocked = !!status && !status.usable;

  // Aviso sobre la barra de escritura cuando la IA no está en el plan.
  const lockedBanner = status && (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <Lock className="size-4 shrink-0" aria-hidden />
        <span className="truncate">
          {AIS[tool].nombre} no está en tu plan ·{" "}
          {access.accesos[tool]
            ? `acceso mensual hasta el ${new Date(access.accesos[tool]!).toLocaleDateString("es-CO")}`
            : (access.pruebas[tool] ?? 0) > 0
              ? `te ${access.pruebas[tool] === 1 ? "queda 1 prueba" : `quedan ${access.pruebas[tool]} pruebas`} gratis hoy`
              : access.tokens > 0
                ? `usando tus tokens (${status.label})`
                : `ya usaste ${PLANS[sub.plan].pruebasDiarias === 1 ? "tu prueba" : "tus pruebas"} de hoy`}
        </span>
      </span>
      {!access.accesos[tool] && (
        <Button size="sm" className="shrink-0" onClick={() => setUnlockOpen(true)}>Desbloquear</Button>
      )}
    </div>
  );
  const low = restantes && (isImage ? restantes.imagen <= 3 : restantes.texto <= 5);

  const sidebar = (onClose?: () => void) => (
    <ChatSidebar
      chats={chats}
      projects={projects}
      activeId={chatId}
      plan={sub.plan}
      tokens={access.tokens}
      userName={userName}
      userEmail={user.email ?? ""}
      onSelect={(id) => openChat(id)}
      onNew={() => openChat()}
      onRename={renameChat}
      onDelete={(id) => setToDelete({ kind: "chat", id, nombre: chats.find((c) => c.id === id)?.titulo ?? "" })}
      onCreateProject={createProject}
      onRenameProject={renameProject}
      onDeleteProject={(id) => setToDelete({ kind: "proyecto", id, nombre: projects.find((p) => p.id === id)?.nombre ?? "" })}
      onRemoveFromProject={removeFromProject}
      onLogout={() => void supabase.auth.signOut()}
      onClose={onClose}
    />
  );

  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      <aside className="hidden shrink-0 border-r border-border md:block">{sidebar()}</aside>
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="h-full shadow-2xl">{sidebar(() => setMenuOpen(false))}</div>
          <button type="button" aria-label="Cerrar menú" className="flex-1 bg-black/60" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-2 sm:px-4">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden">
            <Menu className="size-5" aria-hidden />
          </button>
          <ToolPicker value={tool} onChange={setTool} incluidas={sub.ias} plan={sub.plan} access={access} />
          <div className="flex-1" />
          <button type="button" onClick={() => openChat()} aria-label="Nuevo chat" className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden">
            <SquarePen className="size-5" aria-hidden />
          </button>
        </header>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-24">
            <h1 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {firstName ? `${firstName}, ¿en qué trabajamos hoy?` : "¿En qué trabajamos hoy?"}
            </h1>
            <div className="mt-8 w-full max-w-3xl">
              {lockedBanner}
              <Composer ref={composer} placeholder={placeholder} disabled={!!pending || composerLocked} busy={!!pending} onSend={send} />
              <ul className="mx-auto mt-6 grid max-w-xl gap-1 px-1">
                {sub.ias.map((id) => (
                  <li key={id}>
                    <button type="button" onClick={() => chooseSuggestion(id)} className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 text-left text-[15px] text-foreground/90 transition-colors hover:bg-secondary">
                      <AiIcon id={id} className="size-7" />
                      <span><span className="font-medium">{AIS[id].nombre}</span> <span className="text-muted-foreground">· {AIS[id].proposito}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              {loadingChat ? (
                <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="size-6 animate-spin" aria-label="Cargando chat" /></div>
              ) : (
                <MessageList messages={messages} pending={pending} onEdit={(id, text) => void edit(id, text)} />
              )}
            </div>
            {/* pb extra en pantallas angostas: deja libre la esquina del botón de información */}
            <div className="mx-auto w-full max-w-3xl px-3 pb-16 sm:px-6 xl:pb-4">
              {lockedBanner}
              <Composer ref={composer} placeholder={placeholder} disabled={!!pending || loadingChat || composerLocked} busy={!!pending} onSend={send} />
              {low && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {isImage ? `Te quedan ${restantes!.imagen} imágenes hoy` : `Te quedan ${restantes!.texto} mensajes hoy`}
                </p>
              )}
            </div>
          </>
        )}
      </main>

      {locked && <UnlockDialog ai={tool} open={unlockOpen} onOpenChange={setUnlockOpen} token={token} tokens={access.tokens} onBought={() => void refresh()} />}

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogTitle className="font-display text-lg font-bold">{toDelete?.kind === "proyecto" ? "¿Eliminar este proyecto?" : "¿Eliminar este chat?"}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {toDelete?.kind === "proyecto"
              ? `Se borrará la carpeta “${toDelete.nombre}”. Sus chats no se borran: quedan en tu lista.`
              : `Se borrará “${toDelete?.nombre}” con todos sus mensajes. No se puede deshacer.`}
          </DialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button className="bg-[#E5484D] text-white hover:bg-[#D13B40]" onClick={() => void confirmDelete()}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
