import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Clapperboard, Code2, ImagePlus, ListChecks, Loader2, Menu, PenLine, SquarePen, CalendarCheck } from "lucide-react";

import { ChatSidebar, type ChatRow } from "@/components/chat/chat-sidebar";
import { Composer, type ComposerHandle } from "@/components/chat/composer";
import { MessageList } from "@/components/chat/message-list";
import { ToolPicker } from "@/components/chat/tool-picker";
import { MatchTestDialog } from "@/components/match-test-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { SUGGESTIONS } from "@/lib/app-config";
import { getAppInfo, sendChatMessage, type ChatMessage } from "@/lib/chat.functions";
import { TOOLS, type Cat } from "@/lib/demo-config";
import { useSession } from "@/lib/auth";
import { trackEvent } from "@/lib/tracking";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  validateSearch: (s: Record<string, unknown>): { chat?: string | undefined } => ({ chat: typeof s["chat"] === "string" ? s["chat"] : undefined }),
  head: () => ({ meta: [{ title: "Matchia" }, { name: "robots", content: "noindex" }] }),
  component: AppPage,
});

const SUGGESTION_ICONS: Record<Cat, typeof PenLine> = { Imagen: ImagePlus, Escritura: PenLine, Código: Code2, Productividad: CalendarCheck, Video: Clapperboard };
const placeholderFor = (c: Cat) => (c === "Imagen" ? "Describe la imagen que quieres crear" : c === "Video" ? "Describe el video que quieres crear" : `Pregúntale a ${TOOLS[c].nombre}`);

function AppPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  // La app usa el tema oscuro de la marca; se aplica al <body> para que los diálogos también lo tomen.
  useEffect(() => {
    document.body.classList.add("app-theme");
    return () => document.body.classList.remove("app-theme");
  }, []);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/entrar" });
  }, [loading, session, navigate]);

  if (!session) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-label="Cargando" />
      </main>
    );
  }
  return <ChatApp session={session} />;
}

function ChatApp({ session }: { session: Session }) {
  const { chat: chatId } = Route.useSearch();
  const navigate = useNavigate({ from: "/app" });
  const sendFn = useServerFn(sendChatMessage);
  const infoFn = useServerFn(getAppInfo);
  const composer = useRef<ComposerHandle>(null);
  const activeChat = useRef<string | undefined>(chatId);
  const skipLoad = useRef<string | null>(null);

  const [chats, setChats] = useState<ChatRow[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [tool, setTool] = useState<Cat>("Escritura");
  const [pending, setPending] = useState<{ herramienta: Cat } | null>(null);
  const [recomendada, setRecomendada] = useState<Cat | null>(null);
  const [restantes, setRestantes] = useState<{ texto: number; imagen: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ChatRow | null>(null);

  const user = session.user;
  const userName = String(user.user_metadata?.["nombre"] ?? "").trim();
  const firstName = userName.split(" ")[0];

  const token = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token ?? session.access_token, [session]);

  const loadChats = useCallback(async () => {
    const { data } = await supabase.from("chats").select("id, titulo, herramienta, updated_at").order("updated_at", { ascending: false }).limit(300);
    setChats(data ?? []);
  }, []);

  const loadInfo = useCallback(async () => {
    const res = await infoFn({ data: { token: await token() } });
    if (!res.ok) return;
    setRestantes(res.restantes);
    setRecomendada(res.recomendada);
    return res.recomendada;
  }, [infoFn, token]);

  // Al entrar: chats, uso del día e IA recomendada por el test (queda seleccionada en un chat nuevo).
  useEffect(() => {
    void loadChats();
    void loadInfo().then((rec) => {
      if (rec && !activeChat.current) setTool(rec);
    });
  }, [loadChats, loadInfo]);

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
      setTool(chat.herramienta as Cat);
      setLoadingChat(false);
    })();
    return () => {
      cancelled = true;
      setLoadingChat(false);
    };
  }, [chatId, navigate]);

  function openChat(id?: string) {
    setMenuOpen(false);
    void navigate({ search: id ? { chat: id } : {} });
  }

  async function send(text: string) {
    if (pending) return;
    const herramienta = tool;
    const origin = chatId;
    const temp: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", tipo: "texto", contenido: text, imagen_url: null, herramienta, created_at: new Date().toISOString() };
    const localAviso = (contenido: string): ChatMessage => ({ ...temp, id: `aviso-${Date.now()}`, role: "model", tipo: "aviso", contenido });
    setMessages((m) => [...m, temp]);
    setPending({ herramienta });
    void trackEvent("app_mensaje", herramienta);
    try {
      const res = await sendFn({ data: { token: await token(), chatId: origin ?? null, herramienta, texto: text } });
      if (activeChat.current !== origin) return void loadChats(); // el usuario cambió de chat mientras esperaba
      if (!res.ok) {
        setMessages((m) => [...m, localAviso(res.message)]);
        return;
      }
      setMessages((m) => [...m.filter((x) => x.id !== temp.id), res.user, res.reply]);
      const used = res.reply.tipo === "imagen" ? "imagen" : res.reply.tipo === "texto" ? "texto" : null;
      if (used) setRestantes((r) => r && { ...r, [used]: Math.max(0, r[used] - 1) });
      setChats((cs) => [{ id: res.chatId, titulo: res.titulo, herramienta, updated_at: new Date().toISOString() }, ...cs.filter((c) => c.id !== res.chatId)]);
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

  async function rename(id: string, titulo: string) {
    setChats((cs) => cs.map((c) => (c.id === id ? { ...c, titulo } : c)));
    await supabase.from("chats").update({ titulo }).eq("id", id);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    setToDelete(null);
    setChats((cs) => cs.filter((c) => c.id !== id));
    await supabase.from("chats").delete().eq("id", id);
    if (id === chatId) openChat();
  }

  function chooseSuggestion(cat: Cat, prompt: string) {
    setTool(cat);
    composer.current?.fill(prompt);
  }

  const empty = !chatId && messages.length === 0;
  const lowText = restantes && tool !== "Imagen" && tool !== "Video" && restantes.texto <= 5;
  const lowImage = restantes && tool === "Imagen" && restantes.imagen <= 3;

  const sidebar = (onClose?: () => void) => (
    <ChatSidebar
      chats={chats}
      activeId={chatId}
      userName={userName}
      userEmail={user.email ?? ""}
      onSelect={(id) => openChat(id)}
      onNew={() => openChat()}
      onRename={rename}
      onDelete={(id) => setToDelete(chats.find((c) => c.id === id) ?? null)}
      onTest={() => { setMenuOpen(false); setTestOpen(true); }}
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
          <ToolPicker value={tool} onChange={setTool} recomendada={recomendada} />
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
              <Composer ref={composer} placeholder={placeholderFor(tool)} disabled={!!pending} onSend={send} />
              <ul className="mx-auto mt-6 grid max-w-xl gap-1 px-1">
                {SUGGESTIONS.map((s) => {
                  const Icon = SUGGESTION_ICONS[s.cat];
                  return (
                    <li key={s.label}>
                      <button type="button" onClick={() => chooseSuggestion(s.cat, s.prompt)} className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-[15px] text-foreground/90 transition-colors hover:bg-secondary">
                        <Icon className="size-5 text-muted-foreground" aria-hidden /> {s.label}
                      </button>
                    </li>
                  );
                })}
                {!recomendada && (
                  <li>
                    <button type="button" onClick={() => setTestOpen(true)} className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-[15px] text-foreground/90 transition-colors hover:bg-secondary">
                      <ListChecks className="size-5 text-primary" aria-hidden /> Descubre qué IA te conviene (test de 2 minutos)
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              {loadingChat ? (
                <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="size-6 animate-spin" aria-label="Cargando chat" /></div>
              ) : (
                <MessageList messages={messages} pending={pending} />
              )}
            </div>
            {/* pb extra en pantallas angostas: deja libre la esquina del botón de información */}
            <div className="mx-auto w-full max-w-3xl px-3 pb-16 sm:px-6 xl:pb-4">
              <Composer ref={composer} placeholder={placeholderFor(tool)} disabled={!!pending || loadingChat} onSend={send} />
              {(lowText || lowImage) && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {lowImage ? `Te quedan ${restantes!.imagen} imágenes hoy` : `Te quedan ${restantes!.texto} mensajes hoy`}
                </p>
              )}
            </div>
          </>
        )}
      </main>

      <MatchTestDialog
        open={testOpen}
        onOpenChange={(o) => {
          setTestOpen(o);
          if (!o) void loadInfo();
        }}
      />

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogTitle className="font-display text-lg font-bold">¿Eliminar este chat?</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">Se borrará “{toDelete?.titulo}” con todos sus mensajes. No se puede deshacer.</DialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button className={cn("bg-[#E5484D] text-white hover:bg-[#D13B40]")} onClick={() => void confirmDelete()}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
