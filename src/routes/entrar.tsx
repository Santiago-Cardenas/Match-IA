import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, MailCheck } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { PaymentForm } from "@/components/plans/payment-form";
import { PlanCards } from "@/components/plans/plan-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, useSession } from "@/lib/auth";
import { activarSuscripcion } from "@/lib/chat.functions";
import { isPlan, type PlanId } from "@/lib/plans";
import { trackEvent } from "@/lib/tracking";
import { cn } from "@/lib/utils";

type Modo = "entrar" | "registro";
type Paso = "plan" | "cuenta" | "pago";

export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>): { modo?: Modo | undefined; plan?: PlanId | undefined } => ({
    modo: s["modo"] === "registro" ? "registro" : undefined,
    plan: isPlan(s["plan"]) ? s["plan"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Entrar — Matchia" }] }),
  component: Entrar,
});

const inputCls = "h-11 border-[#2A3A60] bg-[#14213D] text-white placeholder:text-[#A9AEC0]/60";
const PASOS: { id: Paso; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "cuenta", label: "Cuenta" },
  { id: "pago", label: "Pago" },
];

function Entrar() {
  const { modo: initialModo, plan: initialPlan } = Route.useSearch();
  const navigate = useNavigate();
  const activarFn = useServerFn(activarSuscripcion);
  const { session, loading } = useSession();
  const [modo, setModo] = useState<Modo>(initialModo ?? (initialPlan ? "registro" : "entrar"));
  const [paso, setPaso] = useState<Paso>(initialPlan ? "cuenta" : "plan");
  const [plan, setPlan] = useState<PlanId | null>(initialPlan ?? null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "confirmar">("idle");
  const [error, setError] = useState<string | null>(null);
  const creating = useRef(false); // mientras se crea la cuenta no se redirige (falta activar el plan)

  useEffect(() => {
    if (!loading && session && !creating.current) void navigate({ to: "/app" });
  }, [loading, session, navigate]);

  async function login(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setError(authErrorMessage(err.message));
      setStatus("idle");
      return;
    }
    void trackEvent("sesion_iniciada");
  }

  function cuenta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPaso("pago");
  }

  // Se llama solo si el pago simulado fue aprobado.
  async function crearCuenta() {
    if (!plan) return;
    creating.current = true;
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { nombre: nombre.trim(), plan }, emailRedirectTo: `${window.location.origin}/app` },
    });
    if (err) {
      creating.current = false;
      setError(authErrorMessage(err.message));
      setPaso("cuenta");
      return;
    }
    void trackEvent("cuenta_creada", plan);
    if (!data.session) {
      // Con confirmación de correo activa: el plan queda en los metadatos y se activa al entrar por primera vez.
      setStatus("confirmar");
      return;
    }
    await activarFn({ data: { token: data.session.access_token, plan } });
    void navigate({ to: "/app" });
  }

  const pasoIdx = PASOS.findIndex((p) => p.id === paso);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-[#14213D] px-4 py-10">
      <Link to="/" aria-label="Matchia, inicio" className="text-3xl">
        <BrandLogo className="h-10" />
      </Link>
      <p className="mt-3 text-sm text-white/70">Encuentra tu IA ideal en 2 minutos</p>

      <div className={cn("mt-8 w-full rounded-xl border border-[#2A3A60] bg-[#1B2A4A] p-6 text-[#F4F5F8] shadow-2xl sm:p-8", modo === "registro" && paso === "plan" ? "max-w-lg" : "max-w-sm")}>
        {status === "confirmar" ? (
          <div className="text-center">
            <MailCheck className="mx-auto size-10 text-[#FF6B4A]" aria-hidden />
            <h1 className="mt-4 font-display text-xl font-bold">Revisa tu correo</h1>
            <p className="mt-2 text-sm text-[#A9AEC0]">Tu pago fue aprobado. Te enviamos un enlace a <strong className="text-white">{email}</strong> para confirmar tu cuenta.</p>
            <Button variant="ghost" className="mt-5 w-full" onClick={() => { setModo("entrar"); setStatus("idle"); }}>Ya la confirmé, iniciar sesión</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#14213D] p-1 text-sm font-medium" role="tablist">
              {(["entrar", "registro"] as Modo[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={modo === m}
                  onClick={() => { setModo(m); setError(null); }}
                  className={cn("h-9 cursor-pointer rounded-md transition-colors", modo === m ? "bg-[#24355A] text-white shadow-sm" : "text-[#A9AEC0] hover:text-white")}
                >
                  {m === "entrar" ? "Iniciar sesión" : "Crear cuenta"}
                </button>
              ))}
            </div>

            {modo === "entrar" ? (
              <form onSubmit={login} className="mt-6 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="a-email">Correo</Label>
                  <Input id="a-email" type="email" required maxLength={255} autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="a-pass">Contraseña</Label>
                  <Input id="a-pass" type="password" required minLength={6} maxLength={72} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                </div>
                {error && <p role="alert" className="text-sm text-[#FF8A6E]">{error}</p>}
                <Button type="submit" size="lg" disabled={status === "sending"} className="h-11 rounded-lg bg-[#FF6B4A] font-display text-base font-semibold text-[#14213D] hover:bg-[#FF8466]">
                  {status === "sending" ? <Loader2 className="animate-spin" aria-hidden /> : "Entrar"}
                </Button>
              </form>
            ) : (
              <div className="mt-6">
                <ol className="mb-5 flex items-center gap-2 text-xs font-medium" aria-label="Pasos">
                  {PASOS.map((p, i) => (
                    <li key={p.id} className={cn("flex items-center gap-2", i <= pasoIdx ? "text-white" : "text-[#A9AEC0]")}>
                      <span className={cn("flex size-6 items-center justify-center rounded-full border", i < pasoIdx ? "border-[#FF6B4A] bg-[#FF6B4A] text-[#14213D]" : i === pasoIdx ? "border-[#FF6B4A] text-white" : "border-[#2A3A60]")}>{i + 1}</span>
                      {p.label}
                      {i < PASOS.length - 1 && <span className="mx-1 h-px w-6 bg-[#2A3A60]" aria-hidden />}
                    </li>
                  ))}
                </ol>

                {paso === "plan" && (
                  <>
                    <h1 className="mb-4 font-display text-xl font-bold">Elige tu plan</h1>
                    <PlanCards value={plan} onChange={setPlan} />
                    <Button size="lg" disabled={!plan} onClick={() => setPaso("cuenta")} className="mt-5 h-11 w-full rounded-lg bg-[#FF6B4A] font-display text-base font-semibold text-[#14213D] hover:bg-[#FF8466]">
                      Continuar
                    </Button>
                  </>
                )}

                {paso === "cuenta" && (
                  <form onSubmit={cuenta} className="grid gap-4">
                    <h1 className="font-display text-xl font-bold">Crea tu cuenta</h1>
                    <div className="grid gap-2">
                      <Label htmlFor="a-nombre">Nombre</Label>
                      <Input id="a-nombre" required maxLength={100} autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="a-email-r">Correo</Label>
                      <Input id="a-email-r" type="email" required maxLength={255} autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="a-pass-r">Contraseña</Label>
                      <Input id="a-pass-r" type="password" required minLength={6} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                    </div>
                    {error && <p role="alert" className="text-sm text-[#FF8A6E]">{error}</p>}
                    <Button type="submit" size="lg" className="h-11 rounded-lg bg-[#FF6B4A] font-display text-base font-semibold text-[#14213D] hover:bg-[#FF8466]">Continuar al pago</Button>
                    <button type="button" onClick={() => setPaso("plan")} className="text-sm text-[#A9AEC0] underline-offset-4 hover:text-white hover:underline">Cambiar de plan</button>
                  </form>
                )}

                {paso === "pago" && plan && (
                  <>
                    <h1 className="mb-4 font-display text-xl font-bold">Pago</h1>
                    <PaymentForm plan={plan} submitLabel="Pagar y crear mi cuenta" onApproved={crearCuenta} onBack={() => setPaso("cuenta")} />
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <Link to="/" className="mt-6 text-sm text-white/70 underline-offset-4 hover:text-white hover:underline">Volver al inicio</Link>
    </main>
  );
}
