import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, Download } from "lucide-react";

import { TOOLS, type Cat } from "@/lib/demo-config";
import type { ChatMessage } from "@/lib/chat.functions";

const toolName = (h: string | null) => (h && h in TOOLS ? TOOLS[h as Cat].nombre : "Matchia");

function ModelMessage({ m }: { m: ChatMessage }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted-foreground">{toolName(m.herramienta)}</p>
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

export function MessageList({ messages, pending }: { messages: ChatMessage[]; pending: { herramienta: Cat } | null }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-6 pt-6 sm:px-6">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-[15px] text-secondary-foreground">
            {m.contenido}
          </div>
        ) : (
          <ModelMessage key={m.id} m={m} />
        ),
      )}
      {pending && (
        <div className="flex flex-col gap-2" role="status">
          <p className="text-xs font-semibold text-muted-foreground">{TOOLS[pending.herramienta].nombre}</p>
          {pending.herramienta === "Imagen" ? (
            <div className="flex aspect-square w-full max-w-md animate-pulse items-center justify-center rounded-xl border border-border bg-surface text-sm text-muted-foreground">
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
