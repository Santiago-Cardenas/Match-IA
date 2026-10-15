import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Clock3,
  CreditCard,
  Eye,
  Layers3,
  MousePointer2,
  ScanEye,
  Sparkles,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { WaitlistForm, type PackId } from "@/components/waitlist-dialog";
import { MatchTestDialog } from "@/components/match-test-dialog";
import { captureUtm, trackEvent } from "@/lib/tracking";
import workspaceImage from "@/assets/matchia-workspace.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MatchIA — Encuentra tu IA ideal. Compruébalo tú mismo." },
      {
        name: "description",
        content: "MatchIA te dejará probar herramientas de IA especializadas en tus propias tareas antes de suscribirte. Regístrate sin costo ni compromiso para cuando estemos activos.",
      },
      { property: "og:title", content: "MatchIA — Encuentra tu IA ideal" },
      {
        property: "og:description",
        content: "Prueba herramientas de IA especializadas con acceso real y temporal. Regístrate sin compromiso para cuando abramos cupos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS = [
  {
    icon: Layers3,
    title: "Elige tu pack",
    text: "Selecciona cuántas herramientas de nicho quieres probar según tu necesidad: Explorador para comparar un par dentro de una misma categoría, o Comparador para probar varias de distintas categorías.",
  },
  {
    icon: CreditCard,
    title: "Pago y activación",
    text: "Cuando MatchIA esté activo, pagarás el pack elegido y recibirás acceso inmediato. Será un pago pequeño para tomar una buena decisión, no una suscripción propia.",
    note: "El registro de hoy no tiene costo ni compromiso.",
  },
  {
    icon: Clock3,
    title: "Prueba real",
    text: "Usa cada herramienta en tus tareas del día a día. Un panel te mostrará cuánto tiempo o tokens te quedan de cada una.",
  },
  {
    icon: BadgeCheck,
    title: "Tu Match final",
    text: "Al agotarse la prueba, recibirás un comparativo personal de cuánto usaste cada herramienta y cómo la calificaste, junto con el precio actualizado y un enlace para suscribirte a la que más te gustó.",
  },
];

const FAQ = [
  {
    q: "¿Esto es una suscripción?",
    a: "No. MatchIA ofrecerá acceso temporal mediante un pack de prueba, no una suscripción propia. Si después quieres suscribirte a una herramienta, esa decisión será tuya.",
  },
  {
    q: "¿Me van a cobrar por registrarme?",
    a: "No. El registro no tiene costo ni compromiso. Todavía no hemos activado los pagos: solo te avisaremos cuando abramos cupos.",
  },
  {
    q: "¿Qué herramientas voy a poder probar?",
    a: "Herramientas especializadas por tarea: escritura y marketing, video, imagen, código, productividad y más. El catálogo definitivo está por confirmar. No se trata de asistentes generales como ChatGPT o Claude.",
  },
  {
    q: "¿Cuándo estará disponible?",
    a: "Todavía no tenemos una fecha de apertura. Si te registras, te avisaremos por correo apenas estemos activos; no tendrás que comprar nada para recibir ese aviso.",
  },
];

function Landing() {
  const [pack, setPack] = useState<PackId | "">("");
  const [testOpen, setTestOpen] = useState(false);

  useEffect(() => {
    captureUtm();
  }, []);

  function registerInterest(eventName: string, selectedPack?: PackId) {
    if (selectedPack) setPack(selectedPack);
    void trackEvent(eventName, selectedPack);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* A. Hero */}
      <section className="relative isolate flex min-h-[540px] h-[78svh] max-h-[720px] flex-col overflow-hidden border-b border-border">
        <img
          src={workspaceImage}
          alt="Espacio de trabajo con herramientas creativas abiertas en un computador y una tableta"
          width={1600}
          height={1000}
          className="absolute inset-0 -z-20 size-full object-cover object-[64%_center]"
          fetchPriority="high"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background/95 via-background/85 to-background/35 sm:from-background/95 sm:via-background/70 sm:to-background/20" />
        <header className="section-shell flex items-center justify-between gap-4 py-6">
          <a href="#inicio" className="font-display text-2xl font-bold text-foreground" aria-label="MatchIA, inicio">Match<span className="text-primary">IA</span><span className="text-primary">.</span></a>
          <Button variant="outline" size="sm" asChild>
            <a href="#registro" onClick={() => registerInterest("cta_header_registro")}>Regístrate <ArrowRight aria-hidden /></a>
          </Button>
        </header>
        <div id="inicio" className="section-shell flex flex-1 flex-col justify-center pb-12 pt-10 sm:pb-16">
          <span className="eyebrow text-primary"><Sparkles className="size-3.5" aria-hidden /> Acceso real, decisiones tuyas</span>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.08] sm:text-6xl lg:text-7xl">
            Encuentra tu IA ideal. Compruébalo tú mismo.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-foreground/85 sm:text-lg">
            Hay decenas de herramientas de IA para cada tarea. Todas prometen ser la mejor. Pruébalas tú mismo antes de decidir cuál pagar.
          </p>
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Button size="lg" className="min-h-12 w-full whitespace-normal px-6 text-center shadow-glow sm:w-auto" asChild>
              <a href="#registro" onClick={() => registerInterest("cta_hero_registro")}>Regístrate sin compromiso <ArrowRight aria-hidden /></a>
            </Button>
            <span className="text-sm text-foreground/75">Sin costo. Te avisamos cuando estemos activos.</span>
          </div>
        </div>
        <a href="#contexto" className="section-shell mb-5 flex items-center gap-2 text-xs font-semibold uppercase text-foreground/70" aria-label="Ver contexto de MatchIA">Explora la idea <ArrowDownRight className="size-4" aria-hidden /></a>
      </section>

      <section id="test" className="border-b border-border py-14 sm:py-20">
        <div className="section-shell flex flex-col items-start gap-5 sm:items-center sm:text-center">
          <span className="eyebrow text-primary"><Sparkles className="size-3.5" aria-hidden /> Test de 1 minuto</span>
          <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">¿Estoy pagando por algo que no aprovecho?</h2>
          <p className="max-w-lg text-base text-muted-foreground">Responde 6 preguntas rápidas y descubre tu perfil. Sin costo y sin compromiso.</p>
          <Button size="lg" className="min-h-12 w-full whitespace-normal px-6 shadow-glow sm:w-auto" onClick={() => { void trackEvent("cta_iniciar_test"); setTestOpen(true); }}>
            Descubre qué tipo de IA te conviene <ArrowRight aria-hidden />
          </Button>
        </div>
      </section>
      <MatchTestDialog open={testOpen} onOpenChange={setTestOpen} />

      <section id="contexto" className="border-b border-border bg-surface/70">
        <div className="section-shell grid gap-0 sm:grid-cols-2">
          <div className="border-b border-border py-7 sm:border-b-0 sm:border-r sm:pr-10">
            <p className="font-display text-3xl font-bold text-primary">24.5%</p>
            <p className="mt-1 text-sm text-muted-foreground">de la población laboral en Colombia ya usa IA</p>
          </div>
          <div className="py-7 sm:pl-10">
            <p className="font-display text-3xl font-bold text-primary">48%</p>
            <p className="mt-1 text-sm text-muted-foreground">de los colombianos usa IA de forma general</p>
          </div>
        </div>
        <p className="section-shell pb-5 text-xs text-muted-foreground">Fuentes: Microsoft Global AI Diffusion Report, Q1 2026 · Cintel, 2026.</p>
      </section>

      {/* B. Problema */}
      <section className="section-shell py-20 sm:py-28">
        <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:gap-16">
          <div>
            <span className="eyebrow">01 / El problema</span>
            <h2 className="mt-5 max-w-xl text-3xl font-bold sm:text-5xl">Demasiadas opciones. Muy poca confianza.</h2>
          </div>
          <p className="self-end text-base leading-relaxed text-muted-foreground sm:text-lg">
            Para escribir, editar video, crear imágenes o programar hay decenas de herramientas especializadas. Los precios se parecen, pero los resultados y las curvas de aprendizaje no. Elegir sin probar es apostar tu tiempo y tu dinero.
          </p>
        </div>
        <div className="mt-14 grid border-t border-border md:grid-cols-3">
          {[
            { number: "01", title: "Te suscribes a ciegas", text: "Un video promocional no te dice cómo funcionará una herramienta con tu trabajo real." },
            { number: "02", title: "Probar todo toma tiempo", text: "Cada herramienta tiene su propio registro y una prueba gratis que quizá no alcanza para decidir." },
            { number: "03", title: "La reseña no es evidencia", text: "Nunca sabes si una recomendación viene de una experiencia honesta o de un acuerdo pagado." },
          ].map((item) => (
            <div key={item.number} className="border-b border-border py-7 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0">
              <span className="font-display text-sm font-semibold text-primary">{item.number}</span>
              <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          <blockquote className="border-l-2 border-primary pl-5 text-lg font-medium italic">“¿Estoy pagando por algo que no aprovecho?”</blockquote>
          <blockquote className="border-l-2 border-primary pl-5 text-lg font-medium italic">“¿Cómo sé que una reseña en internet es honesta y no pagada?”</blockquote>
        </div>
      </section>

      {/* C. Solución */}
      <section className="border-y border-border bg-surface/60 py-20 sm:py-28">
        <div className="section-shell grid gap-10 md:grid-cols-[1fr_1fr] md:gap-20">
          <div>
            <span className="eyebrow">02 / La solución</span>
            <h2 className="mt-5 max-w-xl text-3xl font-bold sm:text-5xl">Tu criterio vale más que cualquier ranking.</h2>
          </div>
          <div className="space-y-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
            <p>MatchIA no es un test de personalidad ni un algoritmo que recomienda a ciegas. Es acceso real y temporal, medido en horas o tokens, a herramientas especializadas para que las uses en tus propias tareas antes de suscribirte.</p>
            <p>Piensa en herramientas de escritura como Jasper y Copy.ai, de video como Synthesia y HeyGen, de imagen como Midjourney o asistentes personalizados como CustomGPT. El catálogo definitivo se confirmará antes de abrir.</p>
            <p className="border-l-2 border-primary pl-5 font-display text-xl font-semibold leading-snug text-foreground">A diferencia de los blogs comparativos, aquí no lees opiniones de otros: usas las herramientas tú mismo.</p>
          </div>
        </div>
      </section>

      {/* D. Cómo funciona */}
      <section className="section-shell py-20 sm:py-28">
        <span className="eyebrow">03 / Cómo funciona</span>
        <h2 className="mt-5 text-3xl font-bold sm:text-5xl">De la duda a tu propio criterio.</h2>
        <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="border-t-2 border-primary/50 pt-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-3xl font-bold text-primary">0{index + 1}</span>
                  <Icon className="size-5 text-muted-foreground" aria-hidden />
                </div>
                <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                {step.note && <p className="mt-4 text-xs font-semibold text-success">{step.note}</p>}
              </li>
            );
          })}
        </ol>
      </section>

      {/* E. Packs */}
      <section id="packs" className="scroll-mt-8 border-y border-border bg-surface/60 py-20 sm:py-28">
        <div className="section-shell">
          <span className="eyebrow">04 / Los packs</span>
          <h2 className="mt-5 max-w-2xl text-3xl font-bold sm:text-5xl">Dos formas de probar. Tú eliges.</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <article className="flex flex-col rounded-md border border-border bg-background p-7 sm:p-9">
              <span className="text-sm font-semibold text-primary">Para enfocarte en una tarea</span>
              <h3 className="mt-4 text-3xl font-bold">Explorador</h3>
              <p className="mt-5 flex-1 text-base leading-relaxed text-muted-foreground">Compara un par de herramientas dentro de una misma categoría. Por ejemplo, dos opciones de escritura con IA, probadas en tu propio trabajo.</p>
              <Button variant="secondary" size="lg" className="mt-8 min-h-12 w-full whitespace-normal" asChild>
                <a href="#registro" onClick={() => registerInterest("cta_registro_explorador", "Explorador")}>Me interesa Explorador <ArrowRight aria-hidden /></a>
              </Button>
            </article>
            <article className="flex flex-col rounded-md border border-primary/60 bg-background p-7 sm:p-9">
              <span className="text-sm font-semibold text-primary">Para explorar distintas tareas</span>
              <h3 className="mt-4 text-3xl font-bold">Comparador</h3>
              <p className="mt-5 flex-1 text-base leading-relaxed text-muted-foreground">Prueba varias herramientas de categorías diferentes a la vez. Ideal si escribes, creas imágenes o video y resuelves distintas tareas en tu día a día.</p>
              <Button size="lg" className="mt-8 min-h-12 w-full whitespace-normal" asChild>
                <a href="#registro" onClick={() => registerInterest("cta_registro_comparador", "Comparador")}>Me interesa Comparador <ArrowRight aria-hidden /></a>
              </Button>
            </article>
          </div>
          <p className="mt-7 max-w-3xl text-sm text-muted-foreground">Aún no hemos activado los pagos. Regístrate para elegir tu pack sin compromiso y te avisamos apenas abramos cupos.</p>
        </div>
      </section>

      {/* F. Transparencia */}
      <section className="border-b border-border py-20 sm:py-28">
        <div className="section-shell grid gap-12 md:grid-cols-[1fr_1fr] md:gap-20">
          <div>
            <span className="eyebrow"><Eye className="size-4" aria-hidden /> 05 / Transparencia</span>
            <h2 className="mt-5 max-w-xl text-3xl font-bold sm:text-5xl">Así ganaremos dinero. Sin esconderlo.</h2>
            <p className="mt-6 font-display text-xl font-semibold text-primary sm:text-2xl">Sin reseñas pagadas. Sin letra pequeña.</p>
          </div>
          <div className="self-center divide-y divide-border border-y border-border">
            <div className="py-6"><h3 className="text-lg font-semibold">El pago del pack de prueba</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Cuando el servicio esté activo, ese pago cubrirá tu acceso temporal a las herramientas reales que pruebes.</p></div>
            <div className="py-6"><h3 className="text-lg font-semibold">Una comisión de afiliado, si decides seguir</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Si al terminar eliges suscribirte a una herramienta, podremos recibir una comisión. Lo diremos de frente: tu comparativo se basará en lo que tú probaste y calificaste.</p></div>
          </div>
        </div>
      </section>

      {/* G. Comparación */}
      <section className="border-b border-border bg-surface/60 py-20 sm:py-28">
        <div className="section-shell">
          <span className="eyebrow">06 / Compara las opciones</span>
          <h2 className="mt-5 max-w-2xl text-3xl font-bold sm:text-5xl">Una opinión no es lo mismo que probar.</h2>
          <div className="mt-12 grid gap-0 border-t border-border md:grid-cols-3">
            {[
              { icon: ScanEye, title: "Blogs y comparadores", text: "Lees opiniones de terceros. No sabes si la reseña responde a tu necesidad ni si hay un acuerdo comercial detrás." },
              { icon: MousePointer2, title: "Probar por tu cuenta", text: "Tienes que registrarte en cada herramienta, aprender a usarla por separado y aprovechar pruebas gratuitas limitadas." },
              { icon: Sparkles, title: "MatchIA", text: "Tendrás acceso real y temporal en un solo lugar, comparación directa y un resultado basado en lo que tú hiciste, sin registrarte herramienta por herramienta." },
            ].map((option) => {
              const Icon = option.icon;
              return (
                <div key={option.title} className="border-b border-border py-8 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0">
                  <Icon className={`size-6 ${option.title === "MatchIA" ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
                  <h3 className="mt-5 text-xl font-semibold">{option.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{option.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* H. Registro */}
      <section id="registro" className="scroll-mt-0 border-b border-border py-20 sm:py-28">
        <div className="section-shell grid gap-10 md:grid-cols-[1fr_1fr] md:gap-20">
          <div>
            <span className="eyebrow">07 / Registro anticipado</span>
            <h2 className="mt-5 max-w-lg text-3xl font-bold sm:text-5xl">Apúntate ahora. Decide después.</h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">Dinos qué te gustaría probar y te escribiremos cuando MatchIA esté activo. Sin pagos, sin compromisos y sin elegir una herramienta a ciegas.</p>
            <p className="mt-8 flex items-center gap-2 text-sm text-success"><BadgeCheck className="size-5 shrink-0" aria-hidden /> Registrarte hoy no te compromete a comprar.</p>
          </div>
          <WaitlistForm pack={pack} onPackChange={setPack} />
        </div>
      </section>

      {/* I. FAQ */}
      <section className="section-shell py-20 sm:py-28">
        <span className="eyebrow">08 / Preguntas frecuentes</span>
        <h2 className="mt-5 text-3xl font-bold sm:text-5xl">Sin dudas escondidas.</h2>
        <Accordion type="single" collapsible className="mt-9 max-w-4xl border-t border-border">
          {FAQ.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-left text-base font-semibold">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* J. Cierre */}
      <section className="border-t border-border bg-surface py-20 sm:py-28">
        <div className="section-shell flex flex-col items-start sm:items-center sm:text-center">
          <span className="eyebrow">Próximamente</span>
          <h2 className="mt-5 max-w-2xl text-3xl font-bold sm:text-5xl">Sé de los primeros en probar, sin compromiso.</h2>
          <p className="mt-5 max-w-lg text-base text-muted-foreground">Te avisamos apenas estemos activos.</p>
          <Button size="lg" className="mt-8 min-h-12 w-full whitespace-normal px-6 shadow-glow sm:w-auto" asChild>
            <a href="#registro" onClick={() => registerInterest("cta_final_registro")}>Regístrate sin compromiso <ArrowRight aria-hidden /></a>
          </Button>
        </div>
      </section>
      <footer className="border-t border-border py-7">
        <div className="section-shell flex flex-col justify-between gap-2 text-xs text-muted-foreground sm:flex-row"><p>MatchIA · Colombia</p><p>Acceso real. Criterio propio. Próximamente.</p></div>
      </footer>
    </main>
  );
}
