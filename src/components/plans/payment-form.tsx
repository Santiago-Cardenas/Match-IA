import { useState, type FormEvent } from "react";
import { CreditCard, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CUOTAS } from "@/lib/plans";
import { trackEvent } from "@/lib/tracking";

// PAGO SIMULADO (prototipo de investigación): no hay pasarela.
// Los datos de la tarjeta nunca salen del navegador: no se envían al servidor, no se guardan y no se registran.
// Solo se aprueba la tarjeta de prueba "1" con CVV "1"; cualquier otra se rechaza.
const TEST_CARD = "1";
const TEST_CVV = "1";

const inputCls = "h-11 border-[#2A3A60] bg-[#14213D] text-white placeholder:text-[#A9AEC0]/60";
const digits = (v: string) => v.replace(/\D/g, "");

/** concepto/precio = lo que se muestra; evento = detalle para la analítica (nunca datos de la tarjeta). */
export function PaymentForm({ concepto, precio, evento, submitLabel, onApproved, onBack }: { concepto: string; precio: string; evento: string; submitLabel: string; onApproved: () => void | Promise<void>; onBack?: () => void }) {
  const [titular, setTitular] = useState("");
  const [numero, setNumero] = useState("");
  const [vence, setVence] = useState("");
  const [cvv, setCvv] = useState("");
  const [cuotas, setCuotas] = useState(1);
  const [status, setStatus] = useState<"idle" | "procesando">("idle");
  const [error, setError] = useState<string | null>(null);

  function onNumero(v: string) {
    setNumero(digits(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 "));
  }

  function onVence(v: string) {
    const d = digits(v).slice(0, 4);
    setVence(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (status === "procesando") return;
    setStatus("procesando");
    setError(null);
    await new Promise((r) => setTimeout(r, 1800)); // simula la respuesta del banco
    if (digits(numero) === TEST_CARD && cvv === TEST_CVV) {
      void trackEvent("pago_aprobado", evento);
      await onApproved();
      return;
    }
    void trackEvent("pago_rechazado", evento);
    setError("Tu pago fue rechazado. El banco no autorizó la transacción. Verifica los datos o intenta con otra tarjeta.");
    setStatus("idle");
  }

  return (
    <form onSubmit={submit} className="grid gap-4" autoComplete="off">
      <div className="flex items-center justify-between rounded-lg bg-[#14213D] px-4 py-3 text-sm">
        <span className="text-[#A9AEC0]">{concepto}</span>
        <span className="font-display text-base font-bold text-white">{precio}</span>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="p-titular">Nombre en la tarjeta</Label>
        <Input id="p-titular" required maxLength={80} autoComplete="off" value={titular} onChange={(e) => setTitular(e.target.value)} className={inputCls} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="p-numero">Número de tarjeta</Label>
        <div className="relative">
          <CreditCard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A9AEC0]" aria-hidden />
          <Input id="p-numero" required inputMode="numeric" autoComplete="off" placeholder="0000 0000 0000 0000" value={numero} onChange={(e) => onNumero(e.target.value)} className={`${inputCls} pl-9 tracking-wider`} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="p-vence">Vence</Label>
          <Input id="p-vence" required inputMode="numeric" autoComplete="off" placeholder="MM/AA" value={vence} onChange={(e) => onVence(e.target.value)} className={inputCls} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="p-cvv">CVV</Label>
          <Input id="p-cvv" required inputMode="numeric" type="password" autoComplete="off" maxLength={4} value={cvv} onChange={(e) => setCvv(digits(e.target.value).slice(0, 4))} className={inputCls} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="p-cuotas">Cuotas</Label>
          <select id="p-cuotas" value={cuotas} onChange={(e) => setCuotas(Number(e.target.value))} className={`${inputCls} rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B4A]`}>
            {CUOTAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-[#FF8A6E]/40 bg-[#FF6B4A]/10 px-3 py-2 text-sm text-[#FF8A6E]">{error}</p>}
      <Button type="submit" size="lg" disabled={status === "procesando"} className="h-11 rounded-lg bg-[#FF6B4A] font-display text-base font-semibold text-[#14213D] hover:bg-[#FF8466]">
        {status === "procesando" ? <><Loader2 className="animate-spin" aria-hidden /> Procesando pago…</> : <><Lock aria-hidden /> {submitLabel}</>}
      </Button>
      {onBack && status !== "procesando" && (
        <button type="button" onClick={onBack} className="text-sm text-[#A9AEC0] underline-offset-4 hover:text-white hover:underline">Volver</button>
      )}
    </form>
  );
}
