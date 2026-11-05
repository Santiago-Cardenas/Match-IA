import { AiIcon } from "@/components/ai-icon";
import { AIS, AI_ORDER } from "@/lib/ais";

/** Carrusel infinito con todas las IAs disponibles (sin animación si el usuario pidió reducir el movimiento). */
export function AiShowcase() {
  const items = [...AI_ORDER, ...AI_ORDER]; // duplicado para que el bucle no tenga corte
  return (
    <div className="relative overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <ul className="flex w-max gap-4 motion-safe:animate-[marquee_45s_linear_infinite] motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center">
        {items.map((id, i) => (
          <li
            key={`${id}-${i}`}
            aria-hidden={i >= AI_ORDER.length || undefined}
            className="flex w-64 shrink-0 items-start gap-3 rounded-xl border border-border bg-background p-4 motion-reduce:[&:nth-child(n+12)]:hidden"
          >
            <AiIcon id={id} className="size-10" />
            <span>
              <span className="block font-display text-base font-bold">{AIS[id].nombre}</span>
              <span className="block text-xs font-semibold text-primary">{AIS[id].proposito}</span>
              <span className="mt-1.5 block text-sm leading-snug text-muted-foreground">{AIS[id].descripcion}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
