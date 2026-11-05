import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, Download, Pencil } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { Button } from "@/components/ui/button";
import { AIS, toAiId, type AiId } from "@/lib/ais";
import { MAX_MESSAGE_CHARS } from "@/lib/app-config";
import type { ChatMessage } from "@/lib/chat.functions";

function AiLabel({ herramienta }: { herramienta: string | null }) {
  const id = toAiId(herramienta);
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      {id && <AiIcon id={id} boxed={false} className="size-3.5" />} {id ? AIS[id].nombre : "Matchia"}
    </p>
  );
}

function ModelMessage({ m }: { m: ChatMessage }) {
  return (
    <div className="flex flex-col gap-2">
      <AiLabel herramienta={m.herramienta} />
      {m.tipo === "texto" && (
        <div className="chat-markdown text-[15px] text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}>
            {m.contenido}
          </ReactMarkdown>
        </div>
      )}
      {m.tipo === "imagen" && m.imagen_url && (
        <figure className="w-full max-w-md">
          <img src={m.imagen_url} alt="Imagen generada" loading="lazy" className="w-full rounded-xl border border-border" />
          <a href={m.imagen_url} target="_blank" rel="noreferrer" download className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Download className="size-3.5" aria-hidden /> Descargar
          </a>
        </figure>
      )}
      {m.tipo === "aviso" && (
        <p className="flex items-start gap-2 rounded-xl border border-[#FFB449]/40 bg-[#FFB449]/10 px-4 py-3 text-sm text-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#FFB449]" aria-hidden /> {m.contenido}
        </p>
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

export function MessageList({ messages, pending, onEdit }: { messages: ChatMessage[]; pending: { herramienta: AiId } | null; onEdit: (id: string, text: string) => void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-6 pt-6 sm:px-6">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserMessage key={m.id} m={m} canEdit={!pending && !m.id.startsWith("tmp-")} onEdit={onEdit} />
        ) : (
          <ModelMessage key={m.id} m={m} />
        ),
      )}
      {pending && (
        <div className="flex flex-col gap-2" role="status">
          <AiLabel herramienta={pending.herramienta} />
          {AIS[pending.herramienta].tipo === "imagen" ? (
            <div className="flex aspect-square w-full max-w-md animate-pulse items-center justify-center rounded-xl border border-border bg-surface px-6 text-center text-sm text-muted-foreground">
              Creando tu imagen… puede tardar hasta un minuto
            </div>
          ) : (
            <span className="flex gap-1.5 py-2" aria-label="Escribiendo">
              {[0, 150, 300].map((d) => (
                <span key={d} className="size-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />
              ))}
            </span>
          )}
        </div>
      )}
      <div ref={end} />
    </div>
  );
}
