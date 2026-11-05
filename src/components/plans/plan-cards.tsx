import { Check } from "lucide-react";

import { PLANS, PLAN_IDS, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

/** Tarjetas para elegir plan (registro y onboarding). */
export function PlanCards({ value, onChange }: { value: PlanId | null; onChange: (p: PlanId) => void }) {
  return (
    <div className="grid gap-3" role="radiogroup" aria-label="Plan">
      {PLAN_IDS.map((id) => {
        const p = PLANS[id];
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(id)}
            className={cn(
              "relative cursor-pointer rounded-xl border p-4 text-left transition-colors",
              on ? "border-[#FF6B4A] bg-[#FF6B4A]/10" : "border-[#2A3A60] hover:border-[#3B4C75]",
            )}
          >
            {p.recomendado && <span className="absolute -top-2.5 right-4 rounded-full bg-[#FF6B4A] px-2.5 py-0.5 text-[11px] font-semibold text-[#14213D]">Recomendado</span>}
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-display text-lg font-bold text-white">Pack {id}</span>
              <span className="font-display text-lg font-bold text-[#FF8A6E]">{p.precio}</span>
            </span>
            <span className="mt-0.5 block text-xs text-[#A9AEC0]">{p.resumen} · pago único</span>
            <ul className="mt-3 grid gap-1">
              {p.puntos.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-[#F4F5F8]/90">
                  <Check className="mt-0.5 size-4 shrink-0 text-[#FF6B4A]" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
