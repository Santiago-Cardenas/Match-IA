import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Lock } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { AIS, AI_ORDER, type AiId } from "@/lib/ais";
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

/** Selector de IA (como el selector de modelo de ChatGPT). Las IAs fuera del plan se pueden probar o desbloquear. */
export function ToolPicker({ value, onChange, incluidas, plan, access }: { value: AiId; onChange: (id: AiId) => void; incluidas: AiId[]; plan: string; access: AccessInfo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const bloqueadas = AI_ORDER.filter((id) => !incluidas.includes(id));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 font-display text-base font-semibold text-foreground transition-colors hover:bg-secondary"
      >
        <AiIcon id={value} boxed={false} />
        <span className="max-w-[50vw] truncate sm:max-w-none">{AIS[value].nombre}</span>
        {!incluidas.includes(value) && <Lock className="size-3.5 text-muted-foreground" aria-label="Fuera de tu plan" />}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-30 max-h-[70svh] w-[min(23rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-2xl">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">Incluidas en tu Pack {plan}</p>
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
