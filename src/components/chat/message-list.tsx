import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, Check, Copy, Download, Pencil, ThumbsDown, ThumbsUp } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { Button } from "@/components/ui/button";
import { AIS, aiIdsOf, toMix, toolName } from "@/lib/ais";
import { MAX_MESSAGE_CHARS } from "@/lib/app-config";
import type { ChatMessage } from "@/lib/chat.functions";
import { cn } from "@/lib/utils";

function AiLabel({ herramienta }: { herramienta: string | null }) {
  const ids = aiIdsOf(herramienta);
  return (
    <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
      {ids.length > 1 && <span className="rounded bg-primary/15 px-1 py-px text-[10px] font-bold uppercase tracking-wide text-primary">Mix</span>}
      {ids.map((id) => <AiIcon key={id} id={id} boxed={false} className="size-5" />)} {toolName(herramienta)}
    </p>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="chat-markdown text-[15px] text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Muestra el texto como si se fuera generando, de a pocas palabras. Termina en unos 8 s como máximo
 * aunque la respuesta sea larga. onTick sirve para seguir bajando el scroll mientras escribe.
 */
function Typewriter({ text, onTick, onDone }: { text: string; onTick: () => void; onDone: () => void }) {
  const parts = useMemo(() => text.split(/(\s+)/), [text]);
  const [shown, setShown] = useState(0);
  const step = Math.max(2, Math.ceil(parts.length / 280));

  useEffect(() => {
    if (shown >= parts.length) {
      onDone();
      return;
    }
    const t = setTimeout(() => setShown((n) => Math.min(parts.length, n + step)), 18 + Math.random() * 22);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, parts.length]);

  useEffect(onTick, [shown, onTick]);

  return <Markdown text={parts.slice(0, shown).join("")} />;
}

const actionBtn = "flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      // sin permiso de portapapeles: no pasa nada
    }
  }
  return (
    <button type="button" onClick={() => void copy()} className={actionBtn}>
      {done ? <Check className="size-3.5 text-[#3DD6A3]" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {done ? "Copiado" : label}
    </button>
  );
}

function DownloadLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" download className={actionBtn}>
      <Download className="size-3.5" aria-hidden /> Descargar imagen
    </a>
  );
}

/** Pulgar arriba o abajo: ajusta "Tu match" en el perfil. Volver a tocar el mismo quita el voto. */
function Votes({ m, onVote }: { m: ChatMessage; onVote: (id: string, voto: -1 | 0 | 1) => void }) {
  const voto = m.voto ?? 0;
  const btn = (v: -1 | 1, Icon: typeof ThumbsUp, label: string) => (
    <button
      type="button"
      onClick={() => onVote(m.id, voto === v ? 0 : v)}
      aria-pressed={voto === v}
      aria-label={label}
      title={label}
      className={cn("flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-secondary", voto === v ? "text-primary" : "text-muted-foreground hover:text-foreground")}
    >
      <Icon className={cn("size-4", voto === v && "fill-current")} aria-hidden />
    </button>
  );
  return (
    <>
      {btn(1, ThumbsUp, "Buena respuesta")}
      {btn(-1, ThumbsDown, "Mala respuesta")}
    </>
  );
}

function ModelMessage({ m, animate, onTick, onAnimated, onVote }: { m: ChatMessage; animate: boolean; onTick: () => void; onAnimated: () => void; onVote: (id: string, voto: -1 | 0 | 1) => void }) {
  const [typing, setTyping] = useState(animate && (m.tipo === "texto" || m.tipo === "mix"));
  const done = () => {
    setTyping(false);
    onAnimated();
  };
  const text = typing ? <Typewriter text={m.contenido} onTick={onTick} onDone={done} /> : <Markdown text={m.contenido} />;
  const mix = toMix(m.herramienta);
  const canVote = m.tipo !== "aviso" && !m.id.startsWith("aviso-");

  return (
    <div className="flex flex-col gap-2">
      <AiLabel herramienta={m.herramienta} />
      {m.tipo === "texto" && text}
      {m.tipo === "imagen" && m.imagen_url && (
        <figure className="w-full max-w-md">
          <img src={m.imagen_url} alt="Imagen generada" loading="lazy" className="w-full rounded-xl border border-border" />
        </figure>
      )}
      {/* Mix: el texto listo para copiar y la imagen que lo acompaña, en la misma respuesta */}
      {m.tipo === "mix" && (
        <>
          {text}
          {!typing &&
            (m.imagen_url ? (
              <figure className="w-full max-w-md">
                <img src={m.imagen_url} alt="Imagen que acompaña el texto" loading="lazy" onLoad={onTick} className="w-full rounded-xl border border-border" />
              </figure>
            ) : (
              <p className="flex items-start gap-2 rounded-xl border border-[#FFB449]/40 bg-[#FFB449]/10 px-4 py-3 text-sm text-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#FFB449]" aria-hidden />
                {mix ? AIS[mix.imagen].nombre : "La IA de imagen"} no pudo crear la imagen esta vez. Pide de nuevo en unos segundos y se genera con el texto.
              </p>
            ))}
        </>
      )}
      {m.tipo === "aviso" && (
        <p className="flex items-start gap-2 rounded-xl border border-[#FFB449]/40 bg-[#FFB449]/10 px-4 py-3 text-sm text-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#FFB449]" aria-hidden /> {m.contenido}
        </p>
      )}
      {canVote && !typing && (
        <div className="-ml-2 flex flex-wrap items-center gap-0.5">
          {(m.tipo === "texto" || m.tipo === "mix") && <CopyButton text={m.contenido} label={m.tipo === "mix" ? "Copiar texto" : "Copiar"} />}
          {(m.tipo === "imagen" || m.tipo === "mix") && m.imagen_url && <DownloadLink url={m.imagen_url} />}
          <Votes m={m} onVote={onVote} />
        </div>
      )}
    </div>
  );
}

/** Mensaje del usuario; se puede editar y reenviar (como en ChatGPT). */
function UserMessage({ m, canEdit, onEdit }: { m: ChatMessage; canEdit: boolean; onEdit: (id: string, text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.contenido);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing || !ref.current) return;
    ref.current.focus();
    ref.current.style.height = "auto";
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 320)}px`;
  }, [editing, draft]);

  if (editing) {
    return (
      <div className="ml-auto w-full max-w-[85%] rounded-2xl border border-primary/50 bg-secondary p-3">
        <label htmlFor={`edit-${m.id}`} className="sr-only">Editar mensaje</label>
        <textarea
          id={`edit-${m.id}`}
          ref={ref}
          value={draft}
          maxLength={MAX_MESSAGE_CHARS}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          className="max-h-80 w-full resize-none bg-transparent text-[15px] text-secondary-foreground outline-none"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setDraft(m.contenido); setEditing(false); }}>Cancelar</Button>
          <Button size="sm" disabled={!draft.trim() || draft.trim() === m.contenido} onClick={() => { setEditing(false); onEdit(m.id, draft.trim()); }}>Enviar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group ml-auto flex max-w-[85%] flex-col items-end gap-1">
      <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-[15px] text-secondary-foreground">{m.contenido}</div>
      {canEdit && (
        <button
          type="button"
          onClick={() => { setDraft(m.contenido); setEditing(true); }}
          aria-label="Editar mensaje"
          title="Editar y reenviar"
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

function Pending({ herramienta }: { herramienta: string }) {
  const ids = aiIdsOf(herramienta);
  const mix = toMix(herramienta);
  if (mix) {
    return (
      <p className="flex animate-pulse items-center gap-2 py-2 text-sm text-muted-foreground">
        {AIS[mix.texto].nombre} está escribiendo y {AIS[mix.imagen].nombre} creará la imagen… puede tardar hasta un minuto
      </p>
    );
  }
  if (ids[0] && AIS[ids[0]].tipo === "imagen") {
    return (
      <div className="flex aspect-square w-full max-w-md animate-pulse items-center justify-center rounded-xl border border-border bg-surface px-6 text-center text-sm text-muted-foreground">
        Creando tu imagen… puede tardar hasta un minuto
      </div>
    );
  }
  return (
    <span className="flex gap-1.5 py-2" aria-label="Escribiendo">
      {[0, 150, 300].map((d) => (
        <span key={d} className="size-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

export function MessageList({ messages, pending, animateId, onAnimated, onEdit, onVote }: {
  messages: ChatMessage[];
  pending: { herramienta: string } | null;
  /** Respuesta recién llegada: se muestra como si se fuera escribiendo. */
  animateId: string | null;
  onAnimated: () => void;
  onEdit: (id: string, text: string) => void;
  onVote: (id: string, voto: -1 | 0 | 1) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  // Mientras escribe (o cuando aparece la imagen de un Mix), baja el scroll solo si la persona seguía al final:
  // si subió a leer, no la mueve. "pinned" se actualiza con cada scroll de la persona.
  const pinned = useRef(true);
  useEffect(() => {
    const box = root.current?.parentElement;
    if (!box) return;
    const onScroll = () => (pinned.current = box.scrollHeight - box.scrollTop - box.clientHeight < 160);
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => box.removeEventListener("scroll", onScroll);
  }, []);
  const follow = useRef(() => {
    const box = root.current?.parentElement;
    if (box && pinned.current) box.scrollTop = box.scrollHeight;
  }).current;

  return (
    <div ref={root} className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-6 pt-6 sm:px-6">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserMessage key={m.id} m={m} canEdit={!pending && !m.id.startsWith("tmp-")} onEdit={onEdit} />
        ) : (
          <ModelMessage key={m.id} m={m} animate={m.id === animateId} onTick={follow} onAnimated={onAnimated} onVote={onVote} />
        ),
      )}
      {pending && (
        <div className="flex flex-col gap-2" role="status">
          <AiLabel herramienta={pending.herramienta} />
          <Pending herramienta={pending.herramienta} />
        </div>
      )}
      <div ref={end} />
    </div>
  );
}
