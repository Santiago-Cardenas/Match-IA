import { cn } from "@/lib/utils";

// Si existen src/assets/logoNombre.* (logo con nombre) o src/assets/logo.* (solo isotipo), se usan esas imágenes.
// Mientras no estén, se dibuja el logo del manual de identidad con SVG y texto (el build no falla).
const files = import.meta.glob<string>("../assets/{logo,logoNombre}.{png,svg,webp,jpg,jpeg}", { eager: true, import: "default" });
const asset = (name: string) => Object.entries(files).find(([path]) => path.split("/").pop()!.split(".")[0] === name)?.[1];
const LOGO = asset("logo");
const LOGO_NOMBRE = asset("logoNombre");

/** Isotipo: rectángulo base (blanco sobre fondo oscuro, navy sobre claro) y rectángulo coral superpuesto. */
function Isotipo({ tone, className }: { tone: "dark" | "light"; className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden>
      <rect x="0" y="0" width="40" height="40" rx="9" fill={tone === "dark" ? "#FFFFFF" : "#14213D"} />
      <rect x="22" y="0" width="42" height="40" rx="9" fill="#FF6B4A" opacity="0.9" />
    </svg>
  );
}

/**
 * Logo de Matchia.
 * - variant "full": isotipo + nombre (logoNombre); "icon": solo isotipo (logo).
 * - tone "dark": sobre fondo navy/oscuro; "light": sobre fondo claro.
 */
export function BrandLogo({ variant = "full", tone = "dark", className }: { variant?: "full" | "icon"; tone?: "dark" | "light"; className?: string }) {
  const src = variant === "full" ? LOGO_NOMBRE : LOGO;
  if (src) return <img src={src} alt="Matchia" className={cn(variant === "full" ? "h-8 w-auto" : "size-8", className)} />;
  if (variant === "icon") return <Isotipo tone={tone} className={cn("h-6 w-auto", className)} />;
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label="Matchia">
      <Isotipo tone={tone} className="h-[1.1em] w-auto" />
      <span className={cn("font-display font-bold tracking-tight", tone === "dark" ? "text-white" : "text-[#14213D]")}>
        Match<span className="text-[#FF6B4A]">ia</span>
      </span>
    </span>
  );
}
