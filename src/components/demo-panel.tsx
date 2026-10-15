import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Info, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_DISCLAIMER, DEMO_UNAVAILABLE, MAX_CHAT_MESSAGES, MAX_INPUT_CHARS, SHOW_DEMO_DISCLAIMER, TOOLS, type Cat } from "@/lib/demo-config";
import { runImageDemo, runTextDemo } from "@/lib/demo.functions";
import { trackEvent } from "@/lib/tracking";

type Msg = { role: "user" | "model"; text: string };

export function DemoPanel({ categoria, email, onReserve }: { categoria: Cat; email: string; onReserve: () => void }) {
  const tool = TOOLS[categoria];
  const textFn = useServerFn(runTextDemo);
  const imageFn = useServerFn(runImageDemo);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState(DEMO_UNAVAILABLE);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [image, setImage] = useState<string | null>(null);

  const userCount = messages.filter((m) => m.role === "user").length;
  const singleDone = tool.demo !== "chat" && (messages.length > 1 || image);
  const chatDone = tool.demo === "chat" && userCount >= MAX_CHAT_MESSAGES;

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim().slice(0, MAX_INPUT_CHARS);
    if (!text || loading) return;
    setLoading(true);
    const next: Msg[] = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    try {
      const res = tool.demo === "imagen"
        ? await imageFn({ data: { email, prompt: text } })
        : await textFn({ data: { email, categoria: categoria as "Escritura", messages: next } });
      if (!res.ok) {
        setBlockedMsg(res.message);
        setBlocked(true);
        void trackEvent("demo_agotada", categoria);
      } else {
        if (res.image) setImage(res.image);
        if (res.text) setMessages([...next, { role: "model", text: res.text }]);
        void trackEvent("demo_usada", categoria);
      }
    } catch {
      setBlocked(true);
      void trackEvent("demo_agotada", categoria);
    } finally {
      setLoading(false);
    }
  }

  if (tool.demo === "ninguna") {
    return (
      <div className="py-4 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
        <DialogTitle className="mt-5 text-2xl font-bold">{tool.nombre}</DialogTitle>
        <DialogDescription className="mt-2 text-base text-muted-foreground">{tool.descripcion}. {tool.porQue}</DialogDescription>
        <p className="mt-4 text-sm text-foreground/85">Aún no tenemos demo de video. Reserva tu cupo y te avisamos apenas puedas probarla.</p>
        <Button className="mt-6 w-full" size="lg" onClick={onReserve}>Reservar mi cupo</Button>
      </div>
    );
  }

  return (
    <div>
      <DialogTitle className="text-2xl font-bold">Prueba {tool.nombre}</DialogTitle>
      <DialogDescription className="mt-1 text-sm text-muted-foreground">{tool.descripcion}</DialogDescription>
      {SHOW_DEMO_DISCLAIMER && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-xs font-semibold text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {DEMO_DISCLAIMER}
        </p>
      )}

      <div className="mt-5 grid gap-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-8 rounded-md bg-primary/15 p-3 text-sm" : "mr-4 whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-sm"}>
            {m.text}
          </div>
        ))}
        {image && <img src={image} alt="Imagen generada en la demo" className="w-full rounded-md border border-border" />}
        {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Generando…</p>}
      </div>

      {blocked ? (
        <div className="mt-5 rounded-md border border-border bg-surface p-4 text-center">
          <p className="text-sm">{blockedMsg}</p>
          <Button className="mt-4 w-full" size="lg" onClick={onReserve}>Reservar mi cupo</Button>
        </div>
      ) : singleDone || chatDone ? (
        <div className="mt-5 text-center">
          <p className="text-sm text-muted-foreground">Llegaste al límite de esta prueba. Ya tienes tu cupo reservado.</p>
          <Button className="mt-4 w-full" size="lg" variant="outline" onClick={onReserve}>Ver cómo registrarme</Button>
        </div>
      ) : (
        <form onSubmit={send} className="mt-5 grid gap-3">
          <Textarea value={input} onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_CHARS))} placeholder={tool.placeholder} rows={3} maxLength={MAX_INPUT_CHARS} disabled={loading} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{input.length}/{MAX_INPUT_CHARS}</span>
            {tool.demo === "chat" && <span>{MAX_CHAT_MESSAGES - userCount} mensajes restantes</span>}
          </div>
          <Button type="submit" size="lg" disabled={loading || !input.trim()}>{tool.demo === "imagen" ? "Generar imagen" : "Enviar"}</Button>
        </form>
      )}
    </div>
  );
}
