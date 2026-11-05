import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, MailCheck } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, useSession } from "@/lib/auth";
import { trackEvent } from "@/lib/tracking";
import { cn } from "@/lib/utils";

type Modo = "entrar" | "registro";

export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>): { modo?: Modo | undefined } => ({ modo: s["modo"] === "registro" ? "registro" : undefined }),
  head: () => ({ meta: [{ title: "Entrar — Matchia" }] }),
  component: Entrar,
});

function Entrar() {
  const { modo: initial } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [modo, setModo] = useState<Modo>(initial ?? "entrar");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "confirmar">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/app" });
  }, [loading, session, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    if (modo === "registro") {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { nombre: nombre.trim() }, emailRedirectTo: `${window.location.origin}/app` },
      });
      if (err) {
        setError(authErrorMessage(err.message));
        setStatus("idle");
        return;
      }
      void trackEvent("cuenta_creada");
      // Si Supabase pide confirmar el correo no hay sesión todavía.
      if (!data.session) setStatus("confirmar");
      return;
    }
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setError(authErrorMessage(err.message));
      setStatus("idle");
      return;
    }
    void trackEvent("sesion_iniciada");
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-[#14213D] px-4 py-10">
      <Link to="/" aria-label="Matchia, inicio" className="text-3xl">
        <BrandLogo className="h-10" />
      </Link>
      <p className="mt-3 text-sm text-white/70">Encuentra tu IA ideal en 2 minutos</p>

      <div className="mt-8 w-full max-w-sm rounded-xl border border-[#2A3A60] bg-[#1B2A4A] p-6 text-[#F4F5F8] shadow-2xl sm:p-8">
        {status === "confirmar" ? (
          <div className="text-center">
            <MailCheck className="mx-auto size-10 text-[#FF6B4A]" aria-hidden />
            <h1 className="mt-4 font-display text-xl font-bold">Revisa tu correo</h1>
            <p className="mt-2 text-sm text-[#A9AEC0]">Te enviamos un enlace a <strong className="text-white">{email}</strong> para confirmar tu cuenta.</p>
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
            <form onSubmit={submit} className="mt-6 grid gap-4">
              {modo === "registro" && (
                <div className="grid gap-2">
                  <Label htmlFor="a-nombre">Nombre</Label>
                  <Input id="a-nombre" required maxLength={100} autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-11 border-[#2A3A60] bg-[#14213D] text-white placeholder:text-[#A9AEC0]/60" />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="a-email">Correo</Label>
                <Input id="a-email" type="email" required maxLength={255} autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 border-[#2A3A60] bg-[#14213D] text-white placeholder:text-[#A9AEC0]/60" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="a-pass">Contraseña</Label>
                <Input id="a-pass" type="password" required minLength={6} maxLength={72} autoComplete={modo === "registro" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 border-[#2A3A60] bg-[#14213D] text-white placeholder:text-[#A9AEC0]/60" />
              </div>
              {error && <p role="alert" className="text-sm text-[#FF8A6E]">{error}</p>}
              <Button type="submit" size="lg" disabled={status === "sending"} className="h-11 rounded-lg bg-[#FF6B4A] font-display text-base font-semibold text-[#14213D] hover:bg-[#FF8466]">
                {status === "sending" ? <Loader2 className="animate-spin" aria-hidden /> : modo === "registro" ? "Crear mi cuenta" : "Entrar"}
              </Button>
            </form>
          </>
        )}
      </div>
      <Link to="/" className="mt-6 text-sm text-white/70 underline-offset-4 hover:text-white hover:underline">Volver al inicio</Link>
    </main>
  );
}
