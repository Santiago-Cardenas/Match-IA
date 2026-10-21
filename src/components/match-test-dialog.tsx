import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, CheckCircle2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { captureUtm, trackEvent } from "@/lib/tracking";
import { TOOLS, type Cat } from "@/lib/demo-config";
import { MONTH_OPTIONS, NO_PACK_REASONS, PACKS, PAID_AIS, USD_TO_COP, formatCop, formatUsd, type PackId } from "@/lib/test-config";
import { saveTestSession, type TestSession } from "@/lib/test-session.functions";
import { DemoPanel, type DemoProgress } from "@/components/demo-panel";
import { cn } from "@/lib/utils";

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

// Pasos antes de las 6 preguntas: IAs pagadas + meses.
const PRE_STEPS = 2;
const TOTAL_STEPS = PRE_STEPS + QUESTIONS.length;

type Stage = TestSession["paso"];

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

function emptySession(): Omit<TestSession, "id" | "utm_source" | "utm_medium" | "utm_campaign" | "referrer"> {
  return {
    paso: "gasto",
    completado: false,
    ias_pagadas: [],
    meses_sin_uso: null,
    gasto_usd: 0,
    gasto_cop: 0,
    clic_continuar: false,
    respuestas: {},
    categoria_ganadora: null,
    herramienta_recomendada: null,
    match_pct: null,
    puntaje: null,
    nombre: null,
    email: null,
    whatsapp: null,
    demo_estado: null,
    demo_prompts: 0,
    demo_conversacion: [],
    pack_elegido: null,
    motivo_sin_pack: null,
  };
}

export function MatchTestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const saveFn = useServerFn(saveTestSession);
  const sessionId = useRef<string>("");
  const session = useRef(emptySession());
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const [stage, setStage] = useState<Stage>("gasto");
  const [ias, setIas] = useState<string[]>([]);
  const [ninguna, setNinguna] = useState(false);
  const [meses, setMeses] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pack, setPack] = useState<PackId | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);

  const mensual = PAID_AIS.filter((a) => ias.includes(a.nombre)).reduce((s, a) => s + a.usd, 0);
  const gastoUsd = mensual * (meses ?? 1);
  const gastoCop = gastoUsd * USD_TO_COP;
  const result = answers.length === QUESTIONS.length ? compute(answers) : null;
  const tool = result ? TOOLS[result.winner] : null;

  // Guarda la sesión completa en orden (una petición a la vez para que no se pisen).
  function save(patch: Partial<ReturnType<typeof emptySession>>) {
    session.current = { ...session.current, ...patch };
    const payload: TestSession = { id: sessionId.current, ...session.current, ...captureUtm() };
    queue.current = queue.current
      .then(() => saveFn({ data: payload }))
      .catch((e) => console.error("No se pudo guardar el progreso del test", e));
  }

  function go(next: Stage, patch: Partial<ReturnType<typeof emptySession>> = {}) {
    setStage(next);
    save({ ...patch, paso: next });
  }

  useEffect(() => {
    if (!open) return;
    sessionId.current = crypto.randomUUID();
    session.current = emptySession();
    save({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset(o: boolean) {
    onOpenChange(o);
    if (!o) {
      setTimeout(() => {
        setStage("gasto"); setIas([]); setNinguna(false); setMeses(null); setAnswers([]);
        setStatus("idle"); setError(null); setPack(null); setMotivo(null);
      }, 200);
    }
  }

  function toggleIa(nombre: string) {
    setNinguna(false);
    setIas((prev) => (prev.includes(nombre) ? prev.filter((n) => n !== nombre) : [...prev, nombre]));
  }

  function confirmIas() {
    if (ninguna) {
      setMeses(null);
      void trackEvent("gasto_ninguna");
      go("impacto", { ias_pagadas: [], meses_sin_uso: null, gasto_usd: 0, gasto_cop: 0 });
    } else {
      void trackEvent("gasto_ias_seleccionadas");
      go("meses", { ias_pagadas: ias, gasto_usd: mensual, gasto_cop: mensual * USD_TO_COP });
    }
  }

  function chooseMeses(m: number) {
    setMeses(m);
    go("impacto", { meses_sin_uso: m, gasto_usd: mensual * m, gasto_cop: mensual * m * USD_TO_COP });
  }

  function choose(i: number) {
    const next = [...answers, i];
    setAnswers(next);
    const respuestas = Object.fromEntries(next.map((a, idx) => [QUESTIONS[idx]!.id, QUESTIONS[idx]!.options[a]!.label]));
    if (next.length < QUESTIONS.length) {
      save({ respuestas });
      return;
    }
    const r = compute(next);
    void trackEvent("test_completado");
    go("resultado", {
      respuestas,
      categoria_ganadora: r.winner,
      herramienta_recomendada: TOOLS[r.winner].nombre,
      match_pct: r.pct,
      puntaje: r.score,
    });
  }

  function back() {
    if (stage === "meses") return setStage("gasto");
    if (answers.length > 0) return setAnswers(answers.slice(0, -1));
    setStage("impacto");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!result || status === "sending") return;
    setStatus("sending");
    setError(null);
    const utm = captureUtm();
    const respuestas = Object.fromEntries(QUESTIONS.map((q, i) => [q.id, q.options[answers[i]!]!.label]));
    // leads_test se mantiene: la demo valida el correo contra esta tabla.
    const { error: err } = await supabase.from("leads_test").insert({
      nombre: nombre.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim() || null,
      respuestas,
      categoria_ganadora: result.winner,
      puntaje: { ...result.score, match_pct: result.pct },
      ...utm,
    });
    setStatus("idle");
    if (err) {
      setError("No pudimos guardar tus datos. Intenta de nuevo.");
      return;
    }
    void trackEvent("test_lead_reservado");
    void trackEvent("demo_iniciada", result.winner);
    go("demo", { nombre: nombre.trim(), email: email.trim(), whatsapp: whatsapp.trim() || null, demo_estado: "en_curso" });
  }

  function onDemoProgress(p: DemoProgress) {
    save({ demo_estado: p.estado, demo_prompts: p.prompts, demo_conversacion: p.conversacion });
  }

  function onDemoFinish(p: DemoProgress) {
    go("pack", { demo_estado: p.estado, demo_prompts: p.prompts, demo_conversacion: p.conversacion });
  }

  function choosePack(id: PackId) {
    setPack(id);
    void trackEvent(`pack_comprar_${id.toLowerCase()}`, id);
    go("fin", { pack_elegido: id, completado: true });
  }

  function noPack() {
    setPack(null);
    void trackEvent("pack_ninguno");
    go("fin", { pack_elegido: "Ninguno", completado: true });
  }

  function chooseMotivo(m: string) {
    setMotivo(m);
    save({ motivo_sin_pack: m });
  }

  const stepIndex = stage === "gasto" ? 0 : stage === "meses" ? 1 : PRE_STEPS + answers.length;
  const progress = (
    <>
      <p className="text-xs font-semibold uppercase text-muted-foreground">Pregunta {stepIndex + 1} de {TOTAL_STEPS}</p>
      <Progress value={(stepIndex / TOTAL_STEPS) * 100} className="mt-3 h-1.5" />
    </>
  );

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[100svh] w-full max-w-lg overflow-y-auto border-border bg-background p-6 sm:p-8">
        {stage === "gasto" && (
          <div>
            {progress}
            <DialogTitle className="mt-6 text-2xl font-bold leading-tight">¿Cuáles de estas IAs has pagado y terminaste usando poco o cancelando?</DialogTitle>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">Marca todas las que apliquen en el último año.</DialogDescription>
            <div className="mt-6 grid gap-2">
              {PAID_AIS.map((a) => {
                const on = ias.includes(a.nombre);
                return (
                  <button
                    key={a.nombre}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleIa(a.nombre)}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-md border px-4 py-2 text-left text-sm transition-colors",
                      on ? "border-primary bg-primary/15" : "border-border hover:bg-surface",
                    )}
                  >
                    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                      {on && <Check className="size-3.5" aria-hidden />}
                    </span>
                    <span className="flex-1 font-medium">{a.nombre}</span>
                    <span className="text-muted-foreground">{formatUsd(a.usd)}/mes</span>
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={ninguna}
                onClick={() => { setIas([]); setNinguna(!ninguna); }}
                className={cn(
                  "min-h-12 rounded-md border px-4 py-2 text-left text-sm font-medium transition-colors",
                  ninguna ? "border-primary bg-primary/15" : "border-border hover:bg-surface",
                )}
              >
                Ninguna, no he pagado por IAs que no use
              </button>
            </div>
            {ias.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">Suman <strong className="text-foreground">{formatUsd(mensual)} USD al mes</strong></p>
            )}
            <Button size="lg" className="mt-5 w-full" disabled={!ninguna && ias.length === 0} onClick={confirmIas}>
              Continuar <ArrowRight aria-hidden />
            </Button>
          </div>
        )}

        {stage === "meses" && (
          <div>
            {progress}
            <DialogTitle className="mt-6 text-2xl font-bold leading-tight">¿Cuánto tiempo las pagaste antes de cancelarlas o dejar de usarlas?</DialogTitle>
            <DialogDescription className="sr-only">Elige una opción para continuar</DialogDescription>
            <div className="mt-6 grid gap-3">
              {MONTH_OPTIONS.map((o) => (
                <Button key={o.label} variant="outline" className="min-h-14 justify-start whitespace-normal px-5 py-3 text-left text-base" onClick={() => chooseMeses(o.meses)}>
                  {o.label}
                </Button>
              ))}
            </div>
            <button className="mt-5 text-sm text-muted-foreground underline" onClick={back}>Volver</button>
          </div>
        )}

        {stage === "impacto" && (
          <div className="py-2 text-center">
            {gastoUsd > 0 ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tu gasto en IAs que no aprovechaste</p>
                <DialogTitle className="mt-5 font-display text-5xl font-bold text-primary sm:text-6xl">{formatUsd(gastoUsd)} USD</DialogTitle>
                <p className="mt-2 font-display text-2xl font-semibold">≈ {formatCop(gastoCop)} COP</p>
                <DialogDescription className="mt-6 text-lg text-foreground">
                  Has gastado {formatUsd(gastoUsd)} USD, <strong>pero eso cambia ahora.</strong>
                </DialogDescription>
              </>
            ) : (
              <>
                <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
                <DialogTitle className="mt-5 text-2xl font-bold">¡Bien! No has perdido dinero en IAs.</DialogTitle>
                <DialogDescription className="mt-3 text-base text-foreground/85">Y vamos a asegurarnos de que siga así.</DialogDescription>
              </>
            )}
            <Button
              size="lg"
              className="mt-8 min-h-14 w-full whitespace-normal shadow-glow"
              onClick={() => { void trackEvent("gasto_cta_continuar"); go("preguntas", { clic_continuar: true }); }}
            >
              Encontremos tu IA ideal ahora mismo <ArrowRight aria-hidden />
            </Button>
            <button className="mt-5 text-sm text-muted-foreground underline" onClick={() => setStage(ninguna ? "gasto" : "meses")}>Volver</button>
          </div>
        )}

        {stage === "preguntas" && !result && (
          <div>
            {progress}
            <DialogTitle className="mt-6 text-2xl font-bold leading-tight">{QUESTIONS[answers.length]!.q}</DialogTitle>
            <DialogDescription className="sr-only">Elige una opción para continuar</DialogDescription>
            <div className="mt-6 grid gap-3">
              {QUESTIONS[answers.length]!.options.map((o, i) => (
                <Button key={o.label} variant="outline" className="min-h-14 justify-start whitespace-normal px-5 py-3 text-left text-base" onClick={() => choose(i)}>
                  {o.label}
                </Button>
              ))}
            </div>
            <button className="mt-5 text-sm text-muted-foreground underline" onClick={back}>Volver</button>
          </div>
        )}

        {(stage === "resultado" || stage === "datos") && result && tool && (
          <div>
            <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-4 text-primary" aria-hidden /> Tu resultado
            </p>
            <DialogTitle className="mt-4 text-center text-4xl font-bold text-primary sm:text-5xl">Match del {result.pct}%</DialogTitle>
            <DialogDescription className="mt-3 text-center text-base text-foreground/85">
              Tu perfil es de tipo <strong className="text-foreground">{ARCHETYPE[result.winner]}</strong>
            </DialogDescription>
            <div className="mt-6 rounded-md border border-border bg-surface p-5 text-center">
              <p className="text-xs text-muted-foreground">Tu IA recomendada</p>
              <p className="mt-2 font-display text-2xl font-bold">{tool.nombre}</p>
              <p className="text-sm text-primary">{tool.descripcion}</p>
              <p className="mt-3 text-sm text-foreground/85">{tool.porQue}</p>
              {stage === "resultado" && (
                <Button size="lg" className="mt-5 w-full" onClick={() => go("datos")}>Probar ahora <ArrowRight aria-hidden /></Button>
              )}
            </div>
            {stage === "datos" && (
              <>
                <h3 className="mt-8 text-xl font-bold">Déjanos tus datos para probarla</h3>
                <p className="mt-2 text-sm text-muted-foreground">Es sin compromiso. Así también reservas tu cupo para cuando abramos.</p>
                <form onSubmit={submit} className="mt-5 grid gap-4">
                  <div className="grid gap-2"><Label htmlFor="t-nombre">Nombre</Label><Input id="t-nombre" required maxLength={100} placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-12" /></div>
                  <div className="grid gap-2"><Label htmlFor="t-email">Correo</Label><Input id="t-email" type="email" required maxLength={255} placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" /></div>
                  <div className="grid gap-2"><Label htmlFor="t-wa">WhatsApp (opcional)</Label><Input id="t-wa" type="tel" maxLength={30} placeholder="+57 300 000 0000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="h-12" /></div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" size="lg" disabled={status === "sending"} className="min-h-14 w-full whitespace-normal">
                    {status === "sending" ? "Guardando…" : "Probar la herramienta"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">No compartimos tu información con terceros.</p>
                </form>
              </>
            )}
          </div>
        )}

        {stage === "demo" && result && (
          <DemoPanel categoria={result.winner} email={email.trim()} onProgress={onDemoProgress} onFinish={onDemoFinish} />
        )}

        {stage === "pack" && (
          <div>
            <DialogTitle className="text-2xl font-bold leading-tight">¿Quieres comparar varias IAs así, en tus propias tareas?</DialogTitle>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              Esto fue una sola herramienta con pocos prompts. Con un pack de prueba usas varias, sin suscripciones mensuales, y decides con tu propia experiencia.
            </DialogDescription>
            <div className="mt-6 grid gap-4">
              {PACKS.map((p) => (
                <div key={p.id} className={cn("relative rounded-md border p-5", p.recomendado ? "border-primary" : "border-border")}>
                  {p.recomendado && (
                    <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">Recomendado</span>
                  )}
                  <p className="font-display text-lg font-bold">Pack {p.id}</p>
                  <p className="mt-1 text-xl font-bold text-primary">{p.precio} <span className="text-xs font-normal text-muted-foreground">/ pago único</span></p>
                  <ul className="mt-3 grid gap-1 text-sm text-foreground/85">
                    {p.puntos.map((t) => <li key={t}>• {t}</li>)}
                  </ul>
                  <Button className="mt-4 w-full" variant={p.recomendado ? "default" : "outline"} onClick={() => choosePack(p.id)}>
                    {p.cta} <ArrowRight aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
            <button className="mt-5 w-full text-center text-sm text-muted-foreground underline" onClick={noPack}>Por ahora no, gracias</button>
          </div>
        )}

        {stage === "fin" && (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
            {pack ? (
              <>
                <DialogTitle className="mt-5 text-2xl font-bold">¡Gracias por tu interés en el Pack {pack}!</DialogTitle>
                <DialogDescription className="mt-3 text-base text-foreground/85">
                  MatchIA está en fase de validación y todavía no estamos cobrando: no se hizo ningún cargo. Te reservamos el precio de lanzamiento y te escribiremos a <strong>{email}</strong> apenas abramos.
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle className="mt-5 text-2xl font-bold">¡Gracias por probar MatchIA!</DialogTitle>
                <DialogDescription className="mt-3 text-base text-foreground/85">Te avisaremos cuando estemos activos. ¿Nos cuentas por qué no te interesó un pack?</DialogDescription>
                <div className="mt-5 grid gap-2">
                  {NO_PACK_REASONS.map((m) => (
                    <Button key={m} variant="outline" className={cn("min-h-11 whitespace-normal", motivo === m && "border-primary bg-primary/15")} onClick={() => chooseMotivo(m)}>
                      {m}
                    </Button>
                  ))}
                </div>
              </>
            )}
            <Button className="mt-6 w-full" size="lg" variant={pack || motivo ? "default" : "ghost"} onClick={() => reset(false)}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
