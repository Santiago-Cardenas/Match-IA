import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { TOOLS, type Cat } from "@/lib/demo-config";
import { cn } from "@/lib/utils";

export const TOOL_ORDER: Cat[] = ["Escritura", "Código", "Productividad", "Imagen", "Video"];

/** Selector de herramienta (como el selector de modelo de ChatGPT). */
export function ToolPicker({ value, onChange, recomendada }: { value: Cat; onChange: (c: Cat) => void; recomendada: Cat | null }) {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 font-display text-base font-semibold text-foreground transition-colors hover:bg-secondary"
      >
        <span className="max-w-[55vw] truncate sm:max-w-none">{TOOLS[value].nombre}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </button>
      {open && (
        <ul role="listbox" aria-label="Herramienta" className="absolute left-0 top-12 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-1.5 shadow-2xl">
          {TOOL_ORDER.map((c) => (
            <li key={c}>
              <button
                type="button"
                role="option"
                aria-selected={c === value}
                onClick={() => { onChange(c); setOpen(false); }}
                className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
              >
                <span className="flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {TOOLS[c].nombre}
                    {c === recomendada && <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">Tu match</span>}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{TOOLS[c].descripcion}</span>
                </span>
                <Check className={cn("mt-0.5 size-4 shrink-0 text-primary", c === value ? "opacity-100" : "opacity-0")} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
