import { BarChart3, Clapperboard, Code2, GraduationCap, Megaphone, NotebookPen, Palette, PenTool, Presentation, ShieldCheck, SpellCheck, type LucideIcon } from "lucide-react";

import type { AiId } from "@/lib/ais";
import { cn } from "@/lib/utils";

// Logos de cada IA en src/assets/ai-logos/<id>.png (favicons oficiales de cada sitio).
// Si falta alguno, se usa un ícono con el color de acento de esa IA.
const files = import.meta.glob<string>("../assets/ai-logos/*.{png,svg,webp,jpg}", { eager: true, import: "default" });
const LOGOS = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split("/").pop()!.split(".")[0], url])) as Partial<Record<AiId, string>>;

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

/**
 * Logo de una IA.
 * - boxed (por defecto): cuadro de 32px con bordes redondeados (cámbialo con className, p. ej. "size-10").
 * - boxed=false: logo pequeño en línea con texto.
 */
export function AiIcon({ id, className, boxed = true }: { id: AiId; className?: string; boxed?: boolean }) {
  const logo = LOGOS[id];
  const { icon: Icon, color } = STYLE[id];
  if (!boxed) {
    return logo ? (
      <img src={logo} alt="" aria-hidden className={cn("size-4 shrink-0 rounded-[4px] object-cover", className)} />
    ) : (
      <Icon className={cn("size-4", className)} style={{ color }} aria-hidden />
    );
  }
  return logo ? (
    <img src={logo} alt="" aria-hidden className={cn("size-8 shrink-0 rounded-lg object-cover", className)} />
  ) : (
    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", className)} style={{ backgroundColor: `${color}22` }} aria-hidden>
      <Icon className="size-4" style={{ color }} />
    </span>
  );
}
