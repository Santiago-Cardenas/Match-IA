import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Layers, Lock } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { AIS, AI_ORDER, IMAGE_AIS, MIX_DEFAULT, TEXT_AIS, mixKey, toMix, type AiId, type Mix } from "@/lib/ais";
import { formatTokens } from "@/lib/plans";
import { cn } from "@/lib/utils";

export type AccessInfo = { pruebas: Partial<Record<AiId, number>>; accesos: Partial<Record<AiId, string>>; tokens: number };

/** Estado de una IA fuera del plan, en pocas palabras. */
export function lockedStatus(id: AiId, a: AccessInfo) {
  if (a.accesos[id]) return { label: "Acceso mensual", usable: true };
  const p = a.pruebas[id] ?? 0;
  if (p > 0) return { label: p === 1 ? "1 prueba hoy" : `${p} pruebas hoy`, usable: true };
  if (a.tokens > 0) return { label: `${formatTokens(a.tokens)} tokens`, usable: true };
  return { label: "Sin pruebas hoy", usable: false };
}

/** Fila de IAs para armar el Mix (una de texto y una de imagen). */
function MixRow({ label, ids, value, incluidas, onPick }: { label: string; ids: AiId[]; value: AiId; incluidas: AiId[]; onPick: (id: AiId) => void }) {
  return (
    <div className="mt-2">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === value}
            onClick={() => onPick(id)}
            className={cn(
              "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors",
              id === value ? "border-primary bg-primary/15 text-foreground" : "border-border text-foreground/85 hover:border-muted-foreground/50",
            )}
          >
            <AiIcon id={id} boxed={false} /> {AIS[id].nombre}
            {!incluidas.includes(id) && <Lock className="size-3 text-muted-foreground" aria-label="Fuera de tu plan" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Selector de IA (como el selector de modelo de ChatGPT). Las IAs fuera del plan se pueden probar o desbloquear.
 * value = una IA ("jasper") o un Mix ("jasper+midjourney"): texto e imagen en una sola respuesta.
 */
export function ToolPicker({ value, onChange, incluidas, plan, access }: { value: string; onChange: (tool: string) => void; incluidas: AiId[]; plan: string; access: AccessInfo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = toMix(value);
  const [mix, setMix] = useState<Mix>(current ?? MIX_DEFAULT);

  useEffect(() => {
    if (current) setMix(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function pickMix(next: Mix) {
    setMix(next);
    onChange(mixKey(next));
  }

  const bloqueadas = AI_ORDER.filter((id) => !incluidas.includes(id));
  const fuera = (id: AiId) => !incluidas.includes(id);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 font-display text-base font-semibold text-foreground transition-colors hover:bg-secondary"
      >
        {current ? (
          <>
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">Mix</span>
            <AiIcon id={current.texto} boxed={false} />
            <span className="max-w-[40vw] truncate sm:max-w-none">{AIS[current.texto].nombre} + {AIS[current.imagen].nombre}</span>
            <AiIcon id={current.imagen} boxed={false} />
          </>
        ) : (
          <>
            <AiIcon id={value as AiId} boxed={false} />
            <span className="max-w-[50vw] truncate sm:max-w-none">{AIS[value as AiId].nombre}</span>
          </>
        )}
        {(current ? fuera(current.texto) || fuera(current.imagen) : fuera(value as AiId)) && <Lock className="size-3.5 text-muted-foreground" aria-label="Fuera de tu plan" />}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-30 max-h-[75svh] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-2xl">
          <div className={cn("rounded-lg border p-3", current ? "border-primary/60 bg-primary/10" : "border-border")}>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="size-4 text-primary" aria-hidden /> Mix · texto e imagen en una sola respuesta
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Una IA escribe el contenido y otra crea la imagen que lo acompaña. Recibes todo listo para copiar y publicar.</p>
            <MixRow label="Escribe" ids={TEXT_AIS} value={mix.texto} incluidas={incluidas} onPick={(id) => pickMix({ ...mix, texto: id })} />
            <MixRow label="Crea la imagen" ids={IMAGE_AIS} value={mix.imagen} incluidas={incluidas} onPick={(id) => pickMix({ ...mix, imagen: id })} />
            <button
              type="button"
              onClick={() => { pickMix(mix); setOpen(false); }}
              className="mt-3 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#FF8466]"
            >
              {current ? <Check className="size-4" aria-hidden /> : null} Usar {AIS[mix.texto].nombre} + {AIS[mix.imagen].nombre}
            </button>
          </div>

          <p className="px-3 pb-1 pt-3 text-xs font-semibold text-muted-foreground">Incluidas en tu Pack {plan}</p>
          <ul role="listbox" aria-label="IA">
            {incluidas.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={id === value}
                  onClick={() => { onChange(id); setOpen(false); }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
                >
                  <AiIcon id={id} />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{AIS[id].nombre}</span>
                    <span className="block text-xs text-muted-foreground">{AIS[id].proposito}</span>
                  </span>
                  <Check className={cn("size-4 shrink-0 text-primary", id === value ? "opacity-100" : "opacity-0")} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {bloqueadas.length > 0 && (
            <>
              <p className="mt-2 border-t border-border px-3 pb-0.5 pt-3 text-xs font-semibold text-muted-foreground">Fuera de tu plan</p>
              <p className="px-3 pb-1 text-[11px] text-muted-foreground">Pruébalas gratis cada día o desbloquéalas.</p>
              <ul>
                {bloqueadas.map((id) => {
                  const st = lockedStatus(id, access);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={id === value}
                        onClick={() => { onChange(id); setOpen(false); }}
                        className={cn("flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-secondary", !st.usable && "opacity-60")}
                      >
                        <AiIcon id={id} />
                        <span className="flex-1">
                          <span className="block text-sm font-semibold">{AIS[id].nombre}</span>
                          <span className="block text-xs text-muted-foreground">{AIS[id].proposito}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <Lock className="size-3" aria-hidden /> {st.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
