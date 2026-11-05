import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { BrandLogo } from "@/components/brand-logo";
import { PaymentForm } from "@/components/plans/payment-form";
import { PlanCards } from "@/components/plans/plan-cards";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AIS } from "@/lib/ais";
import { activarSuscripcion, guardarMatch, type Suscripcion } from "@/lib/chat.functions";
import { MATCH_QUIZ, rankAis, type MatchAnswers } from "@/lib/match-quiz";
import { PLANS, type PlanId } from "@/lib/plans";
import { trackEvent } from "@/lib/tracking";
import { cn } from "@/lib/utils";

const primary = "h-11 rounded-lg bg-[#FF6B4A] font-display text-base font-semibold text-[#14213D] hover:bg-[#FF8466]";

/**
 * Antes de entrar a la app:
 * 1) sin plan → elegir plan y pago simulado; 2) con plan y sin IAs → test de match (una sola vez); 3) resultado.
 */
export function Onboarding({ token, suscripcion, onDone }: { token: () => Promise<string>; suscripcion: Suscripcion | null; onDone: (s: Suscripcion) => void }) {
  const activarFn = useServerFn(activarSuscripcion);
  const matchFn = useServerFn(guardarMatch);
  const [sub, setSub] = useState<Suscripcion | null>(suscripcion);
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [paso, setPaso] = useState<"plan" | "pago">("plan");
  const [answers, setAnswers] = useState<MatchAnswers>([]);
  const [multi, setMulti] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Suscripcion | null>(null);

  async function activar() {
    if (!plan) return;
    const res = await activarFn({ data: { token: await token(), plan } });
    if (res.ok) setSub(res.suscripcion);
    else setError("No pudimos activar tu plan. Intenta de nuevo.");
  }

  async function answer(sel: number[]) {
    const next = [...answers, sel];
    setAnswers(next);
    setMulti([]);
    if (next.length < MATCH_QUIZ.length) return;
    setSaving(true);
    setError(null);
    const res = await matchFn({ data: { token: await token(), respuestas: next } });
    setSaving(false);
    if (!res.ok) {
      setError("No pudimos guardar tu match. Intenta de nuevo.");
      setAnswers(next.slice(0, -1));
      return;
    }
    void trackEvent("match_completado", res.suscripcion.plan);
    setResult(res.suscripcion);
  }

  let body;
  if (!sub) {
    body = (
      <>
        <h1 className="font-display text-2xl font-bold">Activa tu plan</h1>
        <p className="mt-1 text-sm text-[#A9AEC0]">Elige cuántas IAs quieres tener según tu match.</p>
        <div className="mt-6">
          {paso === "plan" ? (
            <>
              <PlanCards value={plan} onChange={setPlan} />
              <Button size="lg" disabled={!plan} onClick={() => setPaso("pago")} className={cn("mt-5 w-full", primary)}>Continuar al pago</Button>
            </>
          ) : (
            plan && <PaymentForm concepto={`Pack ${plan} · pago único`} precio={PLANS[plan].precio} evento={plan} submitLabel="Pagar y activar" onApproved={activar} onBack={() => setPaso("plan")} />
          )}
        </div>
      </>
    );
  } else if (result) {
    const ranking = rankAis(answers);
    body = (
      <>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#FF8A6E]"><Sparkles className="size-4" aria-hidden /> Tu match</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Estas son tus {result.ias.length} IAs ideales</h1>
        <p className="mt-1 text-sm text-[#A9AEC0]">Incluidas en tu Pack {result.plan}. Ya puedes usarlas.</p>
        <ul className="mt-6 grid gap-3">
          {result.ias.map((id) => (
            <li key={id} className="flex items-start gap-3 rounded-xl border border-[#2A3A60] bg-[#14213D] p-4">
              <AiIcon id={id} className="size-10" />
              <span className="flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-base font-bold">{AIS[id].nombre}</span>
                  <span className="text-sm font-semibold text-[#FF8A6E]">{ranking.find((r) => r.id === id)?.pct}% match</span>
                </span>
                <span className="block text-xs text-[#A9AEC0]">{AIS[id].proposito}</span>
                <span className="mt-1.5 block text-sm text-[#F4F5F8]/90">{AIS[id].porQue}</span>
              </span>
            </li>
          ))}
        </ul>
        <Button size="lg" onClick={() => onDone(result)} className={cn("mt-6 w-full", primary)}>Empezar <ArrowRight aria-hidden /></Button>
      </>
    );
  } else {
    const step = answers.length;
    const q = MATCH_QUIZ[Math.min(step, MATCH_QUIZ.length - 1)]!;
    body = saving ? (
      <div className="flex flex-col items-center py-10 text-center">
        <Loader2 className="size-8 animate-spin text-[#FF6B4A]" aria-hidden />
        <p className="mt-4 font-display text-lg font-semibold">Buscando tus IAs ideales…</p>
      </div>
    ) : (
      <>
        <p className="text-xs font-semibold uppercase text-[#A9AEC0]">Test de match · Pregunta {step + 1} de {MATCH_QUIZ.length}</p>
        <Progress value={(step / MATCH_QUIZ.length) * 100} className="mt-3 h-1.5 bg-[#2A3A60]" />
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

  return (
    <main className="flex min-h-svh flex-col items-center bg-[#14213D] px-4 py-10 text-[#F4F5F8]">
      <BrandLogo className="text-2xl" />
      {sub && !result && <p className="mt-3 text-sm text-white/70">Pack {sub.plan} · {PLANS[sub.plan].resumen}</p>}
      <div className="mt-8 w-full max-w-lg rounded-xl border border-[#2A3A60] bg-[#1B2A4A] p-6 shadow-2xl sm:p-8">
        {body}
        {error && <p role="alert" className="mt-4 text-sm text-[#FF8A6E]">{error}</p>}
      </div>
    </main>
  );
}
