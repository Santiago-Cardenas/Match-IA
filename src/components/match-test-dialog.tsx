import { useState, type FormEvent } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { captureUtm, trackEvent } from "@/lib/tracking";
import { TOOLS, type Cat } from "@/lib/demo-config";
import { DemoPanel } from "@/components/demo-panel";

const CATS: Cat[] = ["Escritura", "Video", "Imagen", "Código", "Productividad"];
const all = (n: number) => Object.fromEntries(CATS.map((c) => [c, n])) as Partial<Record<Cat, number>>;

type Option = { label: string; points: Partial<Record<Cat, number>> };
const QUESTIONS: { id: string; q: string; options: Option[] }[] = [
  {
    id: "uso_principal",
    q: "¿Para qué usarás principalmente la IA?",
    options: [
      { label: "Programación y desarrollo", points: { Código: 3 } },
      { label: "Escritura y creación de contenido", points: { Escritura: 3 } },
      { label: "Generación de imágenes", points: { Imagen: 3 } },
      { label: "Edición o generación de video", points: { Video: 3 } },
      { label: "Tareas de oficina y organización", points: { Productividad: 3 } },
      { label: "Uso general variado", points: all(1) },
    ],
  },
  {
    id: "frecuencia",
    q: "¿Con qué frecuencia la usarías?",
    options: [
      { label: "Ocasional", points: all(1) },
      { label: "Diario, uso ligero", points: all(1) },
      { label: "Intensivo, uso profesional diario", points: all(2) },
    ],
  },
  {
    id: "presupuesto",
    q: "¿Cuál es tu presupuesto mensual para herramientas de IA?",
    options: [
      { label: "Solo gratis ($0)", points: {} },
      { label: "Hasta $20", points: {} },
      { label: "Entre $20 y $100", points: {} },
      { label: "Más de $100", points: {} },
    ],
  },
  {
    id: "ecosistema",
    q: "¿Ya usas alguna herramienta o ecosistema de este tipo de forma constante?",
    options: [
      { label: "Escritura o marketing (ej. Copy.ai, Jasper)", points: { Escritura: 3 } },
      { label: "Edición o generación de video (ej. CapCut, Synthesia)", points: { Video: 3 } },
      { label: "Diseño o imagen (ej. Canva, Midjourney)", points: { Imagen: 3 } },
      { label: "Entornos de desarrollo o asistentes de código", points: { Código: 3 } },
      { label: "Suites ofimáticas (Google Workspace, Microsoft 365)", points: { Productividad: 3 } },
      { label: "Ninguna en particular", points: {} },
    ],
  },
  {
    id: "imagen_video",
    q: "¿Necesitas generación de imagen o video como parte de tu uso?",
    options: [
      { label: "Sí, imagen", points: { Imagen: 2 } },
      { label: "Sí, video", points: { Video: 2 } },
      { label: "No, prefiero texto, código u organización", points: { Escritura: 1, Código: 1, Productividad: 1 } },
    ],
  },
  {
    id: "simplicidad",
    q: "¿Qué tan importante es que la herramienta sea simple de usar desde el primer día?",
    options: [
      { label: "Muy importante, quiero algo simple", points: { Productividad: 2, Escritura: 1 } },
      { label: "No me importa, prefiero potencia aunque sea más compleja", points: { Código: 2, Video: 1 } },
    ],
  },
];

const ARCHETYPE: Record<Cat, string> = {
  Escritura: "Creador(a) de contenido",
  Video: "Storyteller audiovisual",
  Imagen: "Diseñador(a) visual",
  Código: "Constructor técnico",
  Productividad: "Organizador(a) estratégico",
};

function compute(answers: number[]) {
  const score = all(0) as Record<Cat, number>;
  answers.forEach((a, i) => {
    for (const [c, p] of Object.entries(QUESTIONS[i]!.options[a]!.points)) score[c as Cat] += p ?? 0;
  });
  const q1 = QUESTIONS[0]!.options[answers[0]!]!.points;
  const winner = [...CATS].sort((a, b) => score[b] - score[a] || (q1[b] ?? 0) - (q1[a] ?? 0))[0]!;
  const total = CATS.reduce((s, c) => s + score[c], 0) || 1;
  const pct = Math.min(97, Math.round(72 + (score[winner] / total) * 60));
  return { score, winner, pct };
}

export function MatchTestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [answers, setAnswers] = useState<number[]>([]);
  const [status, setStatus] = useState<"idle" | "form" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const step = answers.length;
  const finished = step === QUESTIONS.length;
  const result = finished ? compute(answers) : null;
  const tool = result ? TOOLS[result.winner] : null;

  function reset(o: boolean) {
    onOpenChange(o);
    if (!o) setTimeout(() => { setAnswers([]); setStatus("idle"); setError(null); }, 200);
  }

  function goReserve() {
    reset(false);
    setTimeout(() => document.getElementById("registro")?.scrollIntoView({ behavior: "smooth" }), 250);
  }

  function choose(i: number) {
    const next = [...answers, i];
    setAnswers(next);
    if (next.length === QUESTIONS.length) void trackEvent("test_completado");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!result || status === "sending") return;
    setStatus("sending");
    setError(null);
    const utm = captureUtm();
    const respuestas = Object.fromEntries(QUESTIONS.map((q, i) => [q.id, q.options[answers[i]!]!.label]));
    const { error: err } = await supabase.from("leads_test").insert({
      nombre: nombre.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim() || null,
      respuestas,
      categoria_ganadora: result.winner,
      puntaje: { ...result.score, match_pct: result.pct },
      ...utm,
    });
    if (err) {
      setStatus("form");
      setError("No pudimos guardar tus datos. Intenta de nuevo.");
      return;
    }
    void trackEvent("test_lead_reservado");
    void trackEvent("demo_iniciada", result.winner);
    setStatus("done");
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[100svh] w-full max-w-lg overflow-y-auto border-border bg-background p-6 sm:p-8">
        {!finished ? (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Pregunta {step + 1} de {QUESTIONS.length}</p>
            <Progress value={(step / QUESTIONS.length) * 100} className="mt-3 h-1.5" />
            <DialogTitle className="mt-6 text-2xl font-bold leading-tight">{QUESTIONS[step]!.q}</DialogTitle>
            <DialogDescription className="sr-only">Elige una opción para continuar</DialogDescription>
            <div className="mt-6 grid gap-3">
              {QUESTIONS[step]!.options.map((o, i) => (
                <Button key={o.label} variant="outline" className="min-h-14 justify-start whitespace-normal px-5 py-3 text-left text-base" onClick={() => choose(i)}>
                  {o.label}
                </Button>
              ))}
            </div>
            {step > 0 && (
              <button className="mt-5 text-sm text-muted-foreground underline" onClick={() => setAnswers(answers.slice(0, -1))}>Volver</button>
            )}
          </div>
        ) : status === "done" ? (
          <DemoPanel categoria={result!.winner} email={email.trim()} onReserve={goReserve} />
        ) : (
          <div>
            <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-4 text-primary" aria-hidden /> Tu resultado
            </p>
            <DialogTitle className="mt-4 text-center text-4xl font-bold text-primary sm:text-5xl">Match del {result!.pct}%</DialogTitle>
            <DialogDescription className="mt-3 text-center text-base text-foreground/85">
              Tu perfil es de tipo <strong className="text-foreground">{ARCHETYPE[result!.winner]}</strong>
            </DialogDescription>
            <div className="mt-6 rounded-md border border-border bg-surface p-5 text-center">
              <p className="text-xs text-muted-foreground">Tu IA recomendada</p>
              <p className="mt-2 font-display text-2xl font-bold">{tool!.nombre}</p>
              <p className="text-sm text-primary">{tool!.descripcion}</p>
              <p className="mt-3 text-sm text-foreground/85">{tool!.porQue}</p>
              {status === "idle" && (
                <Button size="lg" className="mt-5 w-full" onClick={() => setStatus("form")}>Probar ahora <ArrowRight aria-hidden /></Button>
              )}
            </div>
            {status !== "idle" && (
              <>
                <h3 className="mt-8 text-xl font-bold">Déjanos tus datos para probarla</h3>
                <p className="mt-2 text-sm text-muted-foreground">Es sin compromiso. Así también reservas tu cupo para cuando abramos.</p>
                <form onSubmit={submit} className="mt-5 grid gap-4">
                  <div className="grid gap-2"><Label htmlFor="t-nombre">Nombre</Label><Input id="t-nombre" required maxLength={100} placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-12" /></div>
                  <div className="grid gap-2"><Label htmlFor="t-email">Correo</Label><Input id="t-email" type="email" required maxLength={255} placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" /></div>
                  <div className="grid gap-2"><Label htmlFor="t-wa">WhatsApp (opcional)</Label><Input id="t-wa" type="tel" maxLength={30} placeholder="+57 300 000 0000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="h-12" /></div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" size="lg" disabled={status === "sending"} className="min-h-14 w-full whitespace-normal">
                    {status === "sending" ? "Guardando…" : "Reservar mi cupo y probar la herramienta"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">No compartimos tu información con terceros. Te avisaremos apenas tengas acceso a tu match completo.</p>
                </form>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
