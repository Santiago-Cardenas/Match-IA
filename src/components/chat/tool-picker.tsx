import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Lock } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { AIS, AI_ORDER, type AiId } from "@/lib/ais";
import { cn } from "@/lib/utils";

/** Selector de IA (como el selector de modelo de ChatGPT). Las IAs fuera del plan se ven bloqueadas. */
export function ToolPicker({ value, onChange, incluidas, plan }: { value: AiId; onChange: (id: AiId) => void; incluidas: AiId[]; plan: string }) {
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
              <p className="mt-2 border-t border-border px-3 pb-1 pt-3 text-xs font-semibold text-muted-foreground">No incluidas en tu plan</p>
              <ul>
                {bloqueadas.map((id) => (
                  <li key={id} className="flex items-center gap-3 rounded-lg px-3 py-2 opacity-55" aria-disabled>
                    <AiIcon id={id} />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{AIS[id].nombre}</span>
                      <span className="block text-xs text-muted-foreground">{AIS[id].proposito}</span>
                    </span>
                    <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Bloqueada" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
