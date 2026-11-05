import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Loader2, Mail, Trash2, UserPlus } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AIS, type AiId } from "@/lib/ais";
import { afiliarCuenta, getEmpresa, quitarCuenta, type Cuenta, type Empresa } from "@/lib/chat.functions";
import { PLANS } from "@/lib/plans";
import { trackEvent } from "@/lib/tracking";
import { cn } from "@/lib/utils";

const section = "rounded-xl border border-border bg-background/40 p-4";
const heading = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

function AiChips({ ids }: { ids: AiId[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <li key={id} className="flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-sm">
          <AiIcon id={id} boxed={false} /> {AIS[id].nombre}
        </li>
      ))}
    </ul>
  );
}

/** Perfil de la cuenta y de su empresa. La cuenta administradora también afilia y quita cuentas. */
export function ProfileDialog({ open, onOpenChange, token, empresa: initial, ias, userName, userEmail, onEmpresa }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  token: () => Promise<string>;
  empresa: Empresa;
  ias: AiId[];
  userName: string;
  userEmail: string;
  onEmpresa: (e: Empresa) => void;
}) {
  const getFn = useServerFn(getEmpresa);
  const afiliarFn = useServerFn(afiliarCuenta);
  const quitarFn = useServerFn(quitarCuenta);
  const [empresa, setEmpresa] = useState(initial);
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // "afiliar" o el correo que se está quitando
  const [error, setError] = useState<string | null>(null);
  const admin = empresa.rol === "admin";
  const max = PLANS[empresa.plan].cuentas;
  const usadas = cuentas?.length ?? empresa.cuentas;

  useEffect(() => {
    if (!open) return;
    setError(null);
    void (async () => {
      const res = await getFn({ data: { token: await token() } });
      if (!res.ok) return;
      setEmpresa(res.empresa);
      setCuentas(res.cuentas);
      onEmpresa(res.empresa);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function actualizar(next: Cuenta[]) {
    setCuentas(next);
    const e = { ...empresa, cuentas: next.length };
    setEmpresa(e);
    onEmpresa(e);
  }

  async function afiliar(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("afiliar");
    setError(null);
    const res = await afiliarFn({ data: { token: await token(), email: email.trim() } });
    setBusy(null);
    if (!res.ok) return setError(res.message);
    void trackEvent("cuenta_afiliada", empresa.plan);
    setEmail("");
    actualizar(res.cuentas);
  }

  async function quitar(correo: string) {
    if (busy) return;
    setBusy(correo);
    setError(null);
    const res = await quitarFn({ data: { token: await token(), email: correo } });
    setBusy(null);
    if (!res.ok) return setError(res.message);
    actualizar(res.cuentas);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] max-w-lg overflow-y-auto rounded-xl">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground" aria-hidden>
            {(userName || userEmail).slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <DialogTitle className="truncate font-display text-xl font-bold">{userName || userEmail}</DialogTitle>
            <DialogDescription className="truncate text-sm text-muted-foreground">{userEmail}</DialogDescription>
          </div>
        </div>

        <div className={cn(section, "mt-2")}>
          <p className={heading}>Mi empresa</p>
          <p className="mt-2 flex items-center gap-2 font-display text-lg font-bold"><Building2 className="size-5 text-primary" aria-hidden /> {empresa.nombre}</p>
          <p className="mt-1 flex flex-wrap gap-1.5 text-sm">
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">Pack {empresa.plan} Empresa</span>
            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{admin ? "Cuenta administradora" : "Cuenta afiliada"}</span>
            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{usadas} de {max} cuentas</span>
          </p>
          {empresa.ias.length > 0 && (
            <>
              <p className="mt-4 text-sm font-medium">Recomendadas para la empresa</p>
              <AiChips ids={empresa.ias} />
            </>
          )}
          <p className="mt-4 text-sm font-medium">Tus IAs</p>
          <AiChips ids={ias} />
          <p className="mt-2 text-xs text-muted-foreground">Salen de tu test de match, combinado con el test de la empresa.</p>
        </div>

        {admin && (
          <div className={section}>
            <p className={heading}>Cuentas de la empresa</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Afilia el correo de cada persona de tu equipo. Esa persona crea su cuenta en Matchia con ese correo, en “¿Tu empresa te afilió?”, y queda unida a {empresa.nombre} sin pagar.
            </p>
            <ul className="mt-3 grid gap-1.5">
              {cuentas === null ? (
                <li className="flex justify-center py-3 text-muted-foreground"><Loader2 className="size-5 animate-spin" aria-label="Cargando cuentas" /></li>
              ) : (
                cuentas.map((c) => (
                  <li key={c.email} className="flex items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2">
                    <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.nombre || c.email}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.nombre ? `${c.email} · ` : ""}
                        {c.rol === "admin" ? "Cuenta administradora" : !c.activa ? "Invitación pendiente" : c.testHecho ? "Activa · test hecho" : "Activa · falta su test"}
                      </span>
                    </span>
                    {c.rol !== "admin" && (
                      <button
                        type="button"
                        onClick={() => void quitar(c.email)}
                        disabled={!!busy}
                        aria-label={`Quitar ${c.email}`}
                        title="Quitar de la empresa"
                        className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-[#FF8A6E] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy === c.email ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
            {usadas < max ? (
              <form onSubmit={afiliar} className="mt-3 flex gap-2">
                <label htmlFor="afiliar-email" className="sr-only">Correo de la persona</label>
                <Input id="afiliar-email" type="email" required maxLength={255} placeholder="correo@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
                <Button type="submit" disabled={busy === "afiliar"} className="h-10 shrink-0">
                  {busy === "afiliar" ? <Loader2 className="animate-spin" aria-hidden /> : <><UserPlus aria-hidden /> Afiliar</>}
                </Button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Ya usaste las {max} cuentas de tu Pack {empresa.plan}.</p>
            )}
            {error && <p role="alert" className="mt-2 text-sm text-[#FF8A6E]">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
