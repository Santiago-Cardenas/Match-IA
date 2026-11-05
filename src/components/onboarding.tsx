import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Building2, Check, Loader2, Sparkles } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { BrandLogo } from "@/components/brand-logo";
import { PaymentForm } from "@/components/plans/payment-form";
import { PlanCards } from "@/components/plans/plan-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AIS, type AiId } from "@/lib/ais";
import { activarSuscripcion, guardarMatch, guardarTestEmpresa, type Empresa, type Suscripcion } from "@/lib/chat.functions";
import { EMPRESA_QUIZ, MATCH_QUIZ, type MatchAnswers, type QuizQuestion } from "@/lib/match-quiz";
import { PLANS, type PlanId } from "@/lib/plans";
import { trackEvent } from "@/lib/tracking";
import { cn } from "@/lib/utils";

const primary = "h-11 rounded-lg bg-[#FF6B4A] font-display text-base font-semibold text-[#14213D] hover:bg-[#FF8466]";
const inputCls = "h-11 border-[#2A3A60] bg-[#14213D] text-white placeholder:text-[#A9AEC0]/60";

type Pcts = Partial<Record<AiId, number>>;

/**
 * Antes de entrar a la app:
 * 1) sin empresa → registrar la empresa, elegir pack y pago simulado;
 * 2) cuenta administradora sin test de empresa → test de la empresa (una sola vez) y sus IAs recomendadas;
 * 3) sin IAs → test de match de la cuenta, influido por el de la empresa (una sola vez); 4) resultado.
 */
export function Onboarding({ token, suscripcion, empresa: initialEmpresa, onDone }: {
  token: () => Promise<string>;
  suscripcion: Suscripcion | null;
  empresa: Empresa | null;
  onDone: (s: Suscripcion, e: Empresa) => void;
}) {
  const activarFn = useServerFn(activarSuscripcion);
  const empresaFn = useServerFn(guardarTestEmpresa);
  const matchFn = useServerFn(guardarMatch);
  const [sub, setSub] = useState<Suscripcion | null>(suscripcion);
  const [empresa, setEmpresa] = useState<Empresa | null>(initialEmpresa);
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [paso, setPaso] = useState<"plan" | "pago">("plan");
  const [error, setError] = useState<string | null>(null);
  const [resultEmpresa, setResultEmpresa] = useState<{ empresa: Empresa; pcts: Pcts } | null>(null);
  const [result, setResult] = useState<{ sub: Suscripcion; pcts: Pcts } | null>(null);

  async function activar() {
    if (!plan) return;
    const res = await activarFn({ data: { token: await token(), plan, empresa: nombreEmpresa.trim() } });
    if (!res.ok) return setError("No pudimos activar tu pack. Intenta de nuevo.");
    setSub(res.suscripcion);
    setEmpresa(res.empresa);
  }

  async function testEmpresa(respuestas: MatchAnswers) {
    setError(null);
    const res = await empresaFn({ data: { token: await token(), respuestas } });
    if (!res.ok) {
      setError("No pudimos guardar el test de tu empresa. Intenta de nuevo.");
      return false;
    }
    void trackEvent("test_empresa_completado", res.empresa.plan);
    setResultEmpresa(res);
    return true;
  }

  async function testCuenta(respuestas: MatchAnswers) {
    setError(null);
    const res = await matchFn({ data: { token: await token(), respuestas } });
    if (!res.ok) {
      setError("No pudimos guardar tu match. Intenta de nuevo.");
      return false;
    }
    void trackEvent("match_completado", res.suscripcion.plan);
    setResult({ sub: res.suscripcion, pcts: res.pcts });
    return true;
  }

  let body;
  if (!sub || !empresa) {
    body = (
      <>
        <h1 className="font-display text-2xl font-bold">Registra tu empresa</h1>
        <p className="mt-1 text-sm text-[#A9AEC0]">Tu empresa compra el pack y afilia las cuentas de su equipo. Si tu empresa ya te afilió, entra con el correo que registró.</p>
        <div className="mt-6">
          {paso === "plan" ? (
            <form onSubmit={(e) => { e.preventDefault(); setPaso("pago"); }}>
              <div className="mb-5 grid gap-2">
                <Label htmlFor="o-empresa">Nombre de la empresa</Label>
                <Input id="o-empresa" required minLength={2} maxLength={100} autoComplete="organization" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} className={inputCls} />
              </div>
              <PlanCards value={plan} onChange={setPlan} />
              <Button type="submit" size="lg" disabled={!plan || nombreEmpresa.trim().length < 2} className={cn("mt-5 w-full", primary)}>Continuar al pago</Button>
            </form>
          ) : (
            plan && <PaymentForm concepto={`Pack ${plan} Empresa · pago único`} precio={PLANS[plan].precio} evento={plan} submitLabel="Pagar y activar" onApproved={activar} onBack={() => setPaso("plan")} />
          )}
        </div>
      </>
    );
  } else if (resultEmpresa) {
    body = (
      <>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#FF8A6E]"><Building2 className="size-4" aria-hidden /> Match de {resultEmpresa.empresa.nombre}</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Las IAs que más le sirven a tu empresa</h1>
        <p className="mt-1 text-sm text-[#A9AEC0]">Este resultado influye en el match de cada cuenta de tu equipo. Ahora haz tu propio test.</p>
        <AiList ids={resultEmpresa.empresa.ias} pcts={resultEmpresa.pcts} />
        <Button size="lg" onClick={() => { setEmpresa(resultEmpresa.empresa); setResultEmpresa(null); }} className={cn("mt-6 w-full", primary)}>Hacer mi test <ArrowRight aria-hidden /></Button>
      </>
    );
  } else if (empresa.rol === "admin" && !empresa.testHecho) {
    body = (
      <QuizSteps
        key="empresa"
        quiz={EMPRESA_QUIZ}
        etiqueta={`Test de ${empresa.nombre}`}
        cargando="Buscando las IAs para tu empresa…"
        onComplete={testEmpresa}
      />
    );
  } else if (result) {
    const deEmpresa = result.sub.ias.filter((id) => empresa.ias.includes(id));
    body = (
      <>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#FF8A6E]"><Sparkles className="size-4" aria-hidden /> Tu match</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Estas son tus {result.sub.ias.length} IAs ideales</h1>
        <p className="mt-1 text-sm text-[#A9AEC0]">
          Incluidas en el Pack {result.sub.plan} de {empresa.nombre}. Ya puedes usarlas.
          {deEmpresa.length > 0 && ` ${deEmpresa.length === 1 ? "Una también está" : `${deEmpresa.length} también están`} entre las recomendadas para tu empresa.`}
        </p>
        <AiList ids={result.sub.ias} pcts={result.pcts} empresa={empresa.ias} />
        <Button size="lg" onClick={() => onDone(result.sub, empresa)} className={cn("mt-6 w-full", primary)}>Empezar <ArrowRight aria-hidden /></Button>
      </>
    );
  } else {
    body = (
      <QuizSteps
        key="cuenta"
        quiz={MATCH_QUIZ}
        etiqueta="Tu test de match"
        nota={empresa.testHecho ? `Tus respuestas se combinan con el test de ${empresa.nombre}.` : undefined}
        cargando="Buscando tus IAs ideales…"
        onComplete={testCuenta}
      />
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center bg-[#14213D] px-4 py-10 text-[#F4F5F8]">
      <BrandLogo className="text-2xl" />
      {sub && empresa && !result && <p className="mt-3 text-sm text-white/70">{empresa.nombre} · Pack {empresa.plan} · {PLANS[empresa.plan].resumen}</p>}
      <div className="mt-8 w-full max-w-lg rounded-xl border border-[#2A3A60] bg-[#1B2A4A] p-6 shadow-2xl sm:p-8">
        {body}
        {error && <p role="alert" className="mt-4 text-sm text-[#FF8A6E]">{error}</p>}
      </div>
    </main>
  );
}

function AiList({ ids, pcts, empresa }: { ids: AiId[]; pcts: Pcts; empresa?: AiId[] }) {
  return (
    <ul className="mt-6 grid gap-3">
      {ids.map((id) => (
        <li key={id} className="flex items-start gap-3 rounded-xl border border-[#2A3A60] bg-[#14213D] p-4">
          <AiIcon id={id} className="size-10" />
          <span className="flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-display text-base font-bold">{AIS[id].nombre}</span>
              {pcts[id] !== undefined && <span className="text-sm font-semibold text-[#FF8A6E]">{pcts[id]}% match</span>}
            </span>
            <span className="block text-xs text-[#A9AEC0]">{AIS[id].proposito}</span>
            <span className="mt-1.5 block text-sm text-[#F4F5F8]/90">{AIS[id].porQue}</span>
            {empresa?.includes(id) && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#FF6B4A]/15 px-1.5 py-0.5 text-[11px] font-semibold text-[#FF8A6E]"><Building2 className="size-3" aria-hidden /> Recomendada para tu empresa</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Preguntas de un test, una por pantalla. onComplete devuelve false si no se pudo guardar (vuelve a la última pregunta). */
function QuizSteps({ quiz, etiqueta, nota, cargando, onComplete }: {
  quiz: QuizQuestion[];
  etiqueta: string;
  nota?: string | undefined;
  cargando: string;
  onComplete: (a: MatchAnswers) => Promise<boolean>;
}) {
  const [answers, setAnswers] = useState<MatchAnswers>([]);
  const [multi, setMulti] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  async function answer(sel: number[]) {
    const next = [...answers, sel];
    setAnswers(next);
    setMulti([]);
    if (next.length < quiz.length) return;
    setSaving(true);
    const ok = await onComplete(next);
    setSaving(false);
    if (!ok) setAnswers(next.slice(0, -1));
  }

  if (saving) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Loader2 className="size-8 animate-spin text-[#FF6B4A]" aria-hidden />
        <p className="mt-4 font-display text-lg font-semibold">{cargando}</p>
      </div>
    );
  }

  const step = answers.length;
  const q = quiz[Math.min(step, quiz.length - 1)]!;
  return (
    <>
      <p className="text-xs font-semibold uppercase text-[#A9AEC0]">{etiqueta} · Pregunta {step + 1} de {quiz.length}</p>
      <Progress value={(step / quiz.length) * 100} className="mt-3 h-1.5 bg-[#2A3A60]" />
      {nota && step === 0 && <p className="mt-4 flex items-center gap-2 text-sm text-[#A9AEC0]"><Building2 className="size-4 shrink-0 text-[#FF8A6E]" aria-hidden /> {nota}</p>}
      <h1 className="mt-6 font-display text-2xl font-bold leading-tight">{q.q}</h1>
      {q.ayuda && <p className="mt-1 text-sm text-[#A9AEC0]">{q.ayuda}</p>}
      <div className="mt-6 grid gap-2.5">
        {q.options.map((o, i) => {
          const on = multi.includes(i);
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => {
                if (q.max === 1) return void answer([i]);
                setMulti((m) => (on ? m.filter((x) => x !== i) : m.length < q.max ? [...m, i] : m));
              }}
              aria-pressed={q.max > 1 ? on : undefined}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-[15px] transition-colors",
                on ? "border-[#FF6B4A] bg-[#FF6B4A]/10" : "border-[#2A3A60] hover:border-[#3B4C75] hover:bg-[#24355A]/50",
              )}
            >
              {q.max > 1 && (
                <span className={cn("flex size-5 shrink-0 items-center justify-center rounded border", on ? "border-[#FF6B4A] bg-[#FF6B4A] text-[#14213D]" : "border-[#3B4C75]")}>
                  {on && <Check className="size-3.5" aria-hidden />}
                </span>
              )}
              {o.label}
            </button>
          );
        })}
      </div>
      {q.max > 1 && (
        <Button size="lg" disabled={!multi.length} onClick={() => void answer(multi)} className={cn("mt-5 w-full", primary)}>Continuar</Button>
      )}
      {step > 0 && (
        <button type="button" onClick={() => { setAnswers(answers.slice(0, -1)); setMulti([]); }} className="mt-4 text-sm text-[#A9AEC0] underline-offset-4 hover:text-white hover:underline">Volver</button>
      )}
    </>
  );
}
