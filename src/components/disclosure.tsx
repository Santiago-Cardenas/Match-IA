import { useState } from "react";
import { Info } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Único lugar donde se explica que el prototipo simula las herramientas con otras IAs.
function DisclosureContent() {
  return (
    <DialogContent className="max-h-[90svh] max-w-lg overflow-y-auto rounded-xl">
      <DialogTitle className="font-display text-xl font-bold">Sobre este prototipo</DialogTitle>
      <DialogDescription className="text-sm text-muted-foreground">Matchia está en fase de validación. Esto es lo que debes saber.</DialogDescription>
      <ul className="grid gap-3 text-sm leading-relaxed text-foreground">
        <li>
          <strong>Las herramientas son simulaciones.</strong> Cuando usas una IA con su nombre (por ejemplo Jasper, Tabnine o Midjourney), no es la herramienta oficial ni tenemos relación con esas empresas: es una vista previa del tipo de resultado que podrías obtener.
        </li>
        <li>
          <strong>Qué IA responde de verdad.</strong> Los textos los genera <strong>Google Gemini</strong> y las imágenes <strong>Qwen-Image 2.1</strong> (modelo abierto de Alibaba). La calidad puede ser distinta a la de cada herramienta real.
        </li>
        <li>
          <strong>Los pagos son simulados.</strong> No hay cobros ni pasarela de pago. Los datos de tarjeta que escribas no se envían, no se guardan y no se procesan: solo se acepta la tarjeta de prueba del proyecto.
        </li>
        <li>
          <strong>Tus datos.</strong> Guardamos tus chats y respuestas del test para mejorar el prototipo y no los compartimos con terceros. Tus mensajes se envían a esas IAs solo para generar la respuesta.
        </li>
      </ul>
    </DialogContent>
  );
}

/**
 * Botón de información.
 * - floating: fijo en la esquina inferior derecha (todas las páginas).
 * - inline: ícono pequeño para usar dentro de un diálogo (el flotante queda bloqueado mientras hay un modal abierto).
 */
export function DisclosureButton({ variant = "floating", className }: { variant?: "floating" | "inline"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Información sobre este prototipo"
        title="Información sobre este prototipo"
        className={cn(
          "inline-flex cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          variant === "floating"
            ? "fixed bottom-4 right-4 z-40 size-10 border border-border bg-background text-muted-foreground shadow-lg hover:text-foreground"
            : "size-7 text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        <Info className={variant === "floating" ? "size-5" : "size-4"} aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DisclosureContent />
      </Dialog>
    </>
  );
}
