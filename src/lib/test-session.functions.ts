import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const str = (max: number) => z.string().trim().max(max).nullable();

const sessionInput = z.object({
  id: z.string().uuid(),
  paso: z.enum(["gasto", "meses", "impacto", "preguntas", "resultado", "datos", "demo", "confianza", "pack", "fin"]),
  completado: z.boolean(),
  ias_pagadas: z.array(z.string().max(60)).max(20),
  meses_sin_uso: z.number().int().min(0).max(120).nullable(),
  gasto_usd: z.number().min(0).max(100000),
  gasto_cop: z.number().min(0).max(1000000000),
  clic_continuar: z.boolean(),
  respuestas: z.record(z.string().max(40), z.string().max(200)),
  categoria_ganadora: str(40),
  herramienta_recomendada: str(100),
  match_pct: z.number().int().min(0).max(100).nullable(),
  puntaje: z.record(z.string().max(40), z.number()).nullable(),
  nombre: str(100),
  email: str(255),
  whatsapp: str(30),
  demo_estado: str(30),
  demo_prompts: z.number().int().min(0).max(20),
  demo_conversacion: z.array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(4000) })).max(20),
  clic_probar: z.boolean(),
  confianza_antes: z.number().int().min(1).max(5).nullable(),
  confianza_despues: z.number().int().min(1).max(5).nullable(),
  prueba_decisiva: z.boolean().nullable(),
  clic_suscribirme: z.boolean(),
  pack_elegido: str(30),
  motivo_sin_pack: str(100),
  utm_source: str(200),
  utm_medium: str(200),
  utm_campaign: str(200),
  referrer: str(1000),
});

export type TestSession = z.infer<typeof sessionInput>;

/** Crea o actualiza la fila de la sesión del test (se llama en cada paso). */
export const saveTestSession = createServerFn({ method: "POST" })
  .inputValidator((d) => sessionInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("test_sessions").upsert(data, { onConflict: "id" });
    if (error) console.error("No se pudo guardar la sesión del test", error);
    return { ok: !error };
  });

/** Devuelve los resultados para el panel /resultados. Requiere la clave RESULTS_KEY. */
export const getTestResults = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ key: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env["RESULTS_KEY"];
    if (!expected || data.key !== expected) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rows, error }, { count: visitas }] = await Promise.all([
      supabaseAdmin.from("test_resultados").select("*").order("fecha", { ascending: false }).limit(10000),
      supabaseAdmin.from("cta_clicks").select("id", { count: "exact", head: true }).eq("event_name", "visita_landing"),
    ]);
    if (error) {
      console.error("No se pudieron leer los resultados", error);
      return { ok: false as const };
    }
    return { ok: true as const, rows: rows ?? [], visitas: visitas ?? 0 };
  });
