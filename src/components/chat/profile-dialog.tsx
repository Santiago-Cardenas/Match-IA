import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Brain, Building2, Loader2, Mail, Sparkles, ThumbsDown, ThumbsUp, Trash2, UserPlus } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AIS, type AiId } from "@/lib/ais";
import { afiliarCuenta, getEmpresa, getMiMatch, guardarMemoria, quitarCuenta, type Cuenta, type Empresa } from "@/lib/chat.functions";
import type { MatchActual } from "@/lib/match-quiz";
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

/** "Tu match": qué IA se ajusta mejor a la persona, partiendo del test inicial y ajustado con sus pulgares. */
function TuMatch({ token, ias }: { token: () => Promise<string>; ias: AiId[] }) {
  const matchFn = useServerFn(getMiMatch);
  const [data, setData] = useState<{ match: MatchActual[]; votos: number } | null | "error">(null);

  useEffect(() => {
    void (async () => {
      const res = await matchFn({ data: { token: await token() } });
      setData(res.ok ? { match: res.match, votos: res.votos } : "error");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (data === null) return <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="size-6 animate-spin" aria-label="Cargando tu match" /></div>;
  if (data === "error") return <p className="py-6 text-center text-sm text-muted-foreground">No pudimos cargar tu match. Intenta de nuevo.</p>;

  const [top, ...rest] = data.match;
  if (!top) return null;
  const cambio = (m: MatchActual) => m.actual - m.inicial;

  return (
    <div className="grid gap-3">
      <div className="rounded-xl border border-primary/50 bg-primary/10 p-4">
        <p className={heading}>Tu IA ideal hoy</p>
        <div className="mt-2 flex items-center gap-3">
          <AiIcon id={top.id} className="size-12" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold">{AIS[top.id].nombre}</p>
            <p className="text-sm text-muted-foreground">{AIS[top.id].proposito}</p>
          </div>
          <p className="font-display text-3xl font-bold text-primary">{top.actual}%</p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {data.votos
            ? `Partió de tu test inicial y se ha ajustado con ${data.votos === 1 ? "1 voto" : `${data.votos} votos`} que diste a las respuestas.`
            : "Sale de tu test inicial. Califica las respuestas con 👍 o 👎 y tu match se irá ajustando a cómo trabajas."}
          {!ias.includes(top.id) && " No está en tu pack: puedes probarla o desbloquearla desde el selector de IA."}
        </p>
      </div>

      <ul className="grid gap-1.5">
        {[top, ...rest].map((m, i) => {
          const d = cambio(m);
          return (
            <li key={m.id} className="flex items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2">
              <span className="w-4 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
              <AiIcon id={m.id} className="size-7" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{AIS[m.id].nombre}</span>
                  {ias.includes(m.id) && <span className="shrink-0 rounded bg-primary/15 px-1 py-px text-[10px] font-semibold text-primary">En tu pack</span>}
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-background/70">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${m.actual}%` }} />
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="text-sm font-semibold">{m.actual}%</span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {d !== 0 && (
                    <span className={cn("flex items-center", d > 0 ? "text-[#3DD6A3]" : "text-[#FF8A6E]")}>
                      {d > 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
                      {Math.abs(d)}
                      <span className="sr-only"> puntos desde el test</span>
                    </span>
                  )}
                  {m.up > 0 && <span className="flex items-center gap-0.5"><ThumbsUp className="size-3" aria-label="Votos a favor" />{m.up}</span>}
                  {m.down > 0 && <span className="flex items-center gap-0.5"><ThumbsDown className="size-3" aria-label="Votos en contra" />{m.down}</span>}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Memoria global: lo que todas las IAs saben de la empresa y de la persona en cualquier chat. */
function Memoria({ token, admin, empresa, memoria, onSaved }: { token: () => Promise<string>; admin: boolean; empresa: Empresa; memoria: string; onSaved: (descripcion: string, memoria: string) => void }) {
  const saveFn = useServerFn(guardarMemoria);
  const [descripcion, setDescripcion] = useState(empresa.descripcion ?? "");
  const [nota, setNota] = useState(memoria);
  const [estado, setEstado] = useState<"" | "guardando" | "listo" | "error">("");

  useEffect(() => setNota(memoria), [memoria]);
  useEffect(() => setDescripcion(empresa.descripcion ?? ""), [empresa.descripcion]);

  const cambios = nota.trim() !== memoria.trim() || (admin && descripcion.trim() !== (empresa.descripcion ?? "").trim());

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setEstado("guardando");
    const res = await saveFn({ data: { token: await token(), memoria: nota.trim(), ...(admin ? { descripcion: descripcion.trim() } : {}) } });
    setEstado(res.ok ? "listo" : "error");
    if (res.ok) {
      onSaved(admin ? descripcion.trim() : (empresa.descripcion ?? ""), nota.trim());
      void trackEvent("memoria_guardada");
    }
  }

  return (
    <form onSubmit={guardar} className={section}>
      <p className={cn(heading, "flex items-center gap-1.5")}><Brain className="size-3.5" aria-hidden /> Memoria de tus IAs</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Todas tus IAs ya saben tu nombre, que trabajas en {empresa.nombre} y lo que respondieron en los tests. Agrega lo que no quieres repetir en cada chat.
      </p>
      <label htmlFor="mem-empresa" className="mt-3 block text-sm font-medium">Qué hace {empresa.nombre}</label>
      {admin ? (
        <Textarea
          id="mem-empresa"
          value={descripcion}
          maxLength={1000}
          onChange={(e) => { setDescripcion(e.target.value); setEstado(""); }}
          placeholder="Ej.: Tostadora de café de especialidad en Cali. Vendemos por Instagram y a cafeterías. Tono cercano y local."
          className="mt-1 min-h-20 text-sm"
        />
      ) : (
        <p id="mem-empresa" className="mt-1 rounded-lg bg-secondary/60 px-3 py-2 text-sm text-foreground/90">
          {empresa.descripcion || "La cuenta administradora aún no la ha escrito."}
        </p>
      )}
      <label htmlFor="mem-personal" className="mt-3 block text-sm font-medium">Sobre ti</label>
      <Textarea
        id="mem-personal"
        value={nota}
        maxLength={1000}
        onChange={(e) => { setNota(e.target.value); setEstado(""); }}
        placeholder="Ej.: Llevo las redes de la marca. Prefiero textos cortos y con emojis."
        className="mt-1 min-h-20 text-sm"
      />
      <div className="mt-3 flex items-center justify-end gap-3">
        {estado === "listo" && <span className="text-xs text-[#3DD6A3]">Guardado. Tus IAs ya lo saben.</span>}
        {estado === "error" && <span role="alert" className="text-xs text-[#FF8A6E]">No pudimos guardar. Intenta de nuevo.</span>}
        <Button type="submit" size="sm" disabled={!cambios || estado === "guardando"}>
          {estado === "guardando" ? <Loader2 className="animate-spin" aria-hidden /> : "Guardar memoria"}
        </Button>
      </div>
    </form>
  );
}

/** Perfil de la cuenta y de su empresa, "Tu match" y la memoria. La cuenta administradora también afilia y quita cuentas. */
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
  const [tab, setTab] = useState<"perfil" | "match">("perfil");
  const [empresa, setEmpresa] = useState(initial);
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null);
  const [memoria, setMemoria] = useState("");
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
      setMemoria(res.memoria);
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

  const tabBtn = (id: typeof tab, label: string, Icon: typeof Sparkles) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => { setTab(id); if (id === "match") void trackEvent("tu_match_abierto"); }}
      className={cn("flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors", tab === id ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground")}
    >
      <Icon className="size-4" aria-hidden /> {label}
    </button>
  );

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

        <div role="tablist" aria-label="Secciones del perfil" className="mt-1 flex gap-1 rounded-xl bg-secondary/70 p-1">
          {tabBtn("perfil", "Perfil", Building2)}
          {tabBtn("match", "Tu match", Sparkles)}
        </div>

        {tab === "match" ? (
          <TuMatch token={token} ias={ias} />
        ) : (
          <>
            <div className={section}>
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

            <Memoria
              token={token}
              admin={admin}
              empresa={empresa}
              memoria={memoria}
              onSaved={(descripcion, nota) => {
                setMemoria(nota);
                const e = { ...empresa, descripcion: descripcion || null };
                setEmpresa(e);
                onEmpresa(e);
              }}
            />

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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
