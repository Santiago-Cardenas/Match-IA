import { BarChart3, Clapperboard, Code2, GraduationCap, Megaphone, NotebookPen, Palette, PenTool, Presentation, ShieldCheck, SpellCheck, type LucideIcon } from "lucide-react";

import type { AiId } from "@/lib/ais";
import { cn } from "@/lib/utils";

// Ícono y color de acento de cada IA (no se usan logos de las marcas reales).
const STYLE: Record<AiId, { icon: LucideIcon; color: string }> = {
  jasper: { icon: Megaphone, color: "#FF6B4A" },
  grammarly: { icon: SpellCheck, color: "#3DD6A3" },
  tabnine: { icon: Code2, color: "#7C8CFF" },
  qodo: { icon: ShieldCheck, color: "#5EC8F2" },
  notion: { icon: NotebookPen, color: "#E9E9EF" },
  elicit: { icon: GraduationCap, color: "#FFB449" },
  julius: { icon: BarChart3, color: "#4FD1C5" },
  gamma: { icon: Presentation, color: "#C792EA" },
  synthesia: { icon: Clapperboard, color: "#FF8FA3" },
  midjourney: { icon: Palette, color: "#F5A3FF" },
  ideogram: { icon: PenTool, color: "#9BE15D" },
};

export function AiIcon({ id, className, boxed = true }: { id: AiId; className?: string; boxed?: boolean }) {
  const { icon: Icon, color } = STYLE[id];
  if (!boxed) return <Icon className={cn("size-4", className)} style={{ color }} aria-hidden />;
  return (
    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", className)} style={{ backgroundColor: `${color}22` }} aria-hidden>
      <Icon className="size-4" style={{ color }} />
    </span>
  );
}
