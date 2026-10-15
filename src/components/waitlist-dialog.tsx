import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { captureUtm, type Utm } from "@/lib/tracking";

export type PackId = "Explorador" | "Comparador";

const USE_OPTIONS = [
  { value: "escritura_marketing", label: "Escritura y marketing" },
  { value: "video", label: "Video" },
  { value: "imagen", label: "Imagen" },
  { value: "codigo", label: "Código" },
  { value: "productividad", label: "Productividad" },
  { value: "otro", label: "Otro" },
];

export function WaitlistForm({
  pack,
  onPackChange,
}: {
  pack: PackId | "";
  onPackChange: (pack: PackId) => void;
}) {
  const [utm, setUtm] = useState<Utm>({
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    referrer: null,
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mainUse, setMainUse] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUtm(captureUtm());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pack || !mainUse || status === "sending") return;
    setStatus("sending");
    setError(null);

    const currentUtm = captureUtm();
    const { error: insertError } = await supabase.from("waitlist_signups").insert({
      name: name.trim(),
      email: email.trim(),
      pack,
      main_use: mainUse,
      utm_source: currentUtm.utm_source,
      utm_medium: currentUtm.utm_medium,
      utm_campaign: currentUtm.utm_campaign,
      referrer: currentUtm.referrer,
    });

    if (insertError) {
      console.error(insertError);
      setError("No pudimos guardar tus datos. Intenta de nuevo en un momento.");
      setStatus("idle");
      return;
    }

    setStatus("done");
    setName("");
    setEmail("");
  }

  if (status === "done") {
    return (
      <div role="status" className="flex flex-col items-start justify-center border-t border-border py-8">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <h3 className="mt-6 text-2xl font-bold">Listo. Te avisamos apenas estemos activos, sin ningún compromiso de tu parte.</h3>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Te escribiremos al correo que registraste cuando puedas conocer MatchIA.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 border-t border-border pt-8">
      <input type="hidden" name="utm_source" value={utm.utm_source ?? ""} />
      <input type="hidden" name="utm_medium" value={utm.utm_medium ?? ""} />
      <input type="hidden" name="utm_campaign" value={utm.utm_campaign ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="wl-name">Nombre</Label>
        <Input id="wl-name" name="nombre" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" className="h-12" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wl-email">Correo</Label>
        <Input id="wl-email" name="email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" autoComplete="email" className="h-12" />
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">¿Qué pack te interesa más?</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["Explorador", "Comparador"] as PackId[]).map((option) => (
            <label key={option} className="relative cursor-pointer">
              <input
                type="radio"
                name="pack"
                value={option}
                checked={pack === option}
                onChange={() => onPackChange(option)}
                required
                className="peer sr-only"
              />
              <span className="flex min-h-12 items-center justify-center rounded-md border border-border bg-secondary px-3 text-center text-sm font-semibold text-secondary-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary/15 peer-focus-visible:ring-2 peer-focus-visible:ring-ring">{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="wl-use">¿Para qué tipo de tarea usas más la IA hoy?</Label>
        <select id="wl-use" name="main_use" required value={mainUse} onChange={(e) => setMainUse(e.target.value)} className="h-12 w-full rounded-md border border-input bg-secondary px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="" disabled>Selecciona una tarea</option>
          {USE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="min-h-12 w-full whitespace-normal px-4 text-center" disabled={status === "sending"}>
        {status === "sending" ? "Enviando..." : "Registrarme sin compromiso"}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">El registro no tiene costo. Te contactaremos cuando estemos activos.</p>
    </form>
  );
}
