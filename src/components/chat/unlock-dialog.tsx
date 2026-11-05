import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, CheckCircle2, Coins } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { PaymentForm } from "@/components/plans/payment-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AIS, type AiId } from "@/lib/ais";
import { comprarMes, comprarTokens } from "@/lib/chat.functions";
import { MES_COP, MES_DIAS, TOKEN_PACKS, formatCOP, formatTokens, type TokenPackId } from "@/lib/plans";
import { trackEvent } from "@/lib/tracking";
import { cn } from "@/lib/utils";

type Opcion = { tipo: "mes" } | { tipo: "tokens"; paquete: TokenPackId };

/** Desbloquear una IA fuera del plan: acceso mensual o recarga de tokens (pago simulado). */
export function UnlockDialog({ ai, open, onOpenChange, token, tokens, onBought }: {
  ai: AiId;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  token: () => Promise<string>;
  tokens: number;
  onBought: () => void;
}) {
  const mesFn = useServerFn(comprarMes);
  const tokensFn = useServerFn(comprarTokens);
  const [opcion, setOpcion] = useState<Opcion | null>(null);
  const [paso, setPaso] = useState<"elegir" | "pago" | "listo">("elegir");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setOpcion(null);
      setPaso("elegir");
      setError(null);
      void trackEvent("desbloqueo_abierto", ai);
    }
  }, [open, ai]);

  const nombre = AIS[ai].nombre;
  const pack = opcion?.tipo === "tokens" ? TOKEN_PACKS.find((p) => p.id === opcion.paquete)! : null;
  const concepto = opcion?.tipo === "mes" ? `${nombre} · acceso por ${MES_DIAS} días` : pack ? `Recarga de ${formatTokens(pack.tokens)} tokens` : "";
  const precio = opcion?.tipo === "mes" ? formatCOP(MES_COP) : pack ? formatCOP(pack.cop) : "";

  async function pagar() {
    if (!opcion) return;
    setError(null);
    const t = await token();
    const res = opcion.tipo === "mes" ? await mesFn({ data: { token: t, ia: ai } }) : await tokensFn({ data: { token: t, paquete: opcion.paquete } });
    if (!res.ok) {
      setError("No pudimos activar tu compra. Intenta de nuevo.");
      setPaso("elegir");
      return;
    }
    void trackEvent(opcion.tipo === "mes" ? "compra_mes" : "compra_tokens", opcion.tipo === "mes" ? ai : opcion.paquete);
    setPaso("listo");
    onBought();
  }

  const card = (on: boolean) => cn("w-full cursor-pointer rounded-xl border p-4 text-left transition-colors", on ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground/50");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] max-w-md overflow-y-auto rounded-xl">
        <div className="flex items-center gap-3">
          <AiIcon id={ai} className="size-10" />
          <div>
            <DialogTitle className="font-display text-lg font-bold">Desbloquear {nombre}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">{AIS[ai].proposito} · no está incluida en tu plan</DialogDescription>
          </div>
        </div>

        {paso === "listo" ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-10 text-[#3DD6A3]" aria-hidden />
            <p className="mt-3 font-display text-lg font-bold">¡Listo!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {opcion?.tipo === "mes" ? `Ya tienes acceso completo a ${nombre} por ${MES_DIAS} días.` : `Se cargaron ${formatTokens(pack?.tokens ?? 0)} tokens a tu cuenta. Sirven para cualquier IA fuera de tu plan.`}
            </p>
            <Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>Seguir con {nombre}</Button>
          </div>
        ) : paso === "pago" && opcion ? (
          <PaymentForm concepto={concepto} precio={precio} evento={opcion.tipo === "mes" ? `mes:${ai}` : `tokens:${opcion.paquete}`} submitLabel={`Pagar ${precio}`} onApproved={pagar} onBack={() => setPaso("elegir")} />
        ) : (
          <div className="grid gap-3">
            <button type="button" onClick={() => setOpcion({ tipo: "mes" })} className={card(opcion?.tipo === "mes")} aria-pressed={opcion?.tipo === "mes"}>
              <span className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold"><CalendarCheck className="size-4 text-primary" aria-hidden /> Acceso mensual</span>
                <span className="text-right">
                  <span className="block font-display font-bold text-primary">{formatCOP(MES_COP)}</span>
                  <span className="block text-[11px] text-muted-foreground">{MES_DIAS} días</span>
                </span>
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">Usa {nombre} sin límite de pruebas durante {MES_DIAS} días.</span>
            </button>

            <div className={card(opcion?.tipo === "tokens")}>
              <span className="flex items-center gap-2 font-semibold"><Coins className="size-4 text-primary" aria-hidden /> Pago por tokens</span>
              <span className="mt-1 block text-sm text-muted-foreground">Pagas solo lo que usas. Cada respuesta descuenta sus tokens; una imagen equivale a unos 5.000. Sirven para cualquier IA fuera de tu plan.</span>
              {tokens > 0 && <span className="mt-1 block text-xs text-muted-foreground">Saldo actual: {formatTokens(tokens)} tokens</span>}
              <span className="mt-3 grid grid-cols-3 gap-2">
                {TOKEN_PACKS.map((p) => {
                  const on = opcion?.tipo === "tokens" && opcion.paquete === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setOpcion({ tipo: "tokens", paquete: p.id })}
                      aria-pressed={on}
                      className={cn("cursor-pointer rounded-lg border px-2 py-2 text-center transition-colors", on ? "border-primary bg-primary/15" : "border-border hover:border-muted-foreground/50")}
                    >
                      <span className="block text-sm font-semibold">{formatTokens(p.tokens)}</span>
                      <span className="block text-[11px] text-muted-foreground">{formatCOP(p.cop)}</span>
                    </button>
                  );
                })}
              </span>
            </div>

            {error && <p role="alert" className="text-sm text-[#FF8A6E]">{error}</p>}
            <Button size="lg" disabled={!opcion} onClick={() => setPaso("pago")} className="mt-1 w-full">Continuar al pago</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
