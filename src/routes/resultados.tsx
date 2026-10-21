import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Database } from "@/integrations/supabase/types";
import { getTestResults } from "@/lib/test-session.functions";
import { formatCop, formatUsd } from "@/lib/test-config";

type Row = Database["public"]["Views"]["test_resultados"]["Row"];

export const Route = createFileRoute("/resultados")({
  head: () => ({ meta: [{ title: "Resultados del test — MatchIA" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Resultados,
});

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function toCsv(rows: Row[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]!) as (keyof Row)[];
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // ";" + BOM para que Excel en español lo abra en columnas; Google Sheets lo detecta solo.
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => cell(r[c])).join(";"))].join("\r\n");
}

function download(rows: Row[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `matchia-resultados-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Resultados() {
  const fetchResults = useServerFn(getTestResults);
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ rows: Row[]; visitas: number } | null>(null);

  async function load(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetchResults({ data: { key } });
      if (!res.ok) setError("Clave incorrecta o no se pudieron leer los datos.");
      else setData({ rows: res.rows, visitas: res.visitas });
    } catch {
      setError("No se pudieron leer los datos.");
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <form onSubmit={load} className="grid w-full max-w-sm gap-4">
          <h1 className="text-2xl font-bold">Resultados del test</h1>
          <div className="grid gap-2">
            <Label htmlFor="r-key">Clave de acceso</Label>
            <Input id="r-key" type="password" required value={key} onChange={(e) => setKey(e.target.value)} className="h-12" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" disabled={loading}>{loading ? <Loader2 className="animate-spin" aria-hidden /> : "Ver resultados"}</Button>
        </form>
      </main>
    );
  }

  const { rows, visitas } = data;
  const abrieron = rows.length;
  const calculadora = rows.filter((r) => r.paso !== "gasto");
  const conGasto = rows.filter((r) => (r.gasto_usd ?? 0) > 0);
  const corto = conGasto.filter((r) => (r.meses_sin_uso ?? 99) <= 2);
  const clic = rows.filter((r) => r.clic_continuar);
  const test = rows.filter((r) => r.categoria_ganadora);
  const datos = rows.filter((r) => r.email);
  const demo = rows.filter((r) => (r.demo_prompts ?? 0) > 0);
  const vieronPacks = rows.filter((r) => r.paso === "pack" || r.paso === "fin");
  const compra = rows.filter((r) => r.pack_elegido === "Explorador" || r.pack_elegido === "Comparador");
  const base = visitas || abrieron;

  const tally = (keys: (string | null | undefined)[]) =>
    Object.entries(keys.reduce<Record<string, number>>((m, k) => { if (k) m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);

  const funnel: [string, number][] = [
    ["Abrieron el test", abrieron],
    ["Usaron la calculadora de gasto", calculadora.length],
    ["Clic en “Encontremos tu IA ideal”", clic.length],
    ["Completaron las 6 preguntas", test.length],
    ["Dejaron sus datos", datos.length],
    ["Usaron la demo (≥1 prompt)", demo.length],
    ["Vieron los packs", vieronPacks.length],
    ["Clic en comprar un pack", compra.length],
  ];

  return (
    <main className="min-h-screen bg-background py-10 text-foreground">
      <div className="section-shell">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Resultados del test</h1>
            <p className="mt-1 text-sm text-muted-foreground">{abrieron} sesiones · {visitas} visitas a la landing</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => load()} disabled={loading}>Actualizar</Button>
            <Button onClick={() => download(rows)} disabled={!rows.length}><Download aria-hidden /> Descargar CSV</Button>
          </div>
        </div>

        <h2 className="mt-10 text-lg font-semibold">Deseabilidad 2 · Gasto ineficiente en IA</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Reportan gasto en IAs sin usar" value={`${pct(conGasto.length, calculadora.length)}%`} sub={`${conGasto.length} de ${calculadora.length} que usaron la calculadora`} />
          <Stat label="Gasto promedio reportado" value={`${formatUsd(Math.round(avg(conGasto.map((r) => r.gasto_usd ?? 0))))} USD`} sub={`≈ ${formatCop(avg(conGasto.map((r) => r.gasto_cop ?? 0)))} COP`} />
          <Stat label="Pagaron ≤ 2 meses sin aprovecharla" value={`${pct(corto.length, conGasto.length)}%`} sub={`${corto.length} de ${conGasto.length} con gasto`} meta={60} actual={pct(corto.length, conGasto.length)} />
          <Stat label="Clic en “Encontremos tu IA ideal”" value={`${pct(clic.length, abrieron)}%`} sub={`${clic.length} de ${abrieron} sesiones`} meta={12} actual={pct(clic.length, abrieron)} />
        </div>

        <h2 className="mt-10 text-lg font-semibold">Deseabilidad 3 · Packs de prueba</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Clic en comprar pack / visitantes" value={`${pct(compra.length, base)}%`} sub={`${compra.length} de ${base} ${visitas ? "visitas" : "sesiones"}`} meta={10} actual={pct(compra.length, base)} />
          <Stat label="Clic en comprar pack / vieron packs" value={`${pct(compra.length, vieronPacks.length)}%`} sub={`${compra.length} de ${vieronPacks.length}`} />
          <Stat label="Pack Explorador" value={String(compra.filter((r) => r.pack_elegido === "Explorador").length)} sub="clics" />
          <Stat label="Pack Comparador" value={String(compra.filter((r) => r.pack_elegido === "Comparador").length)} sub="clics" />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="text-lg font-semibold">Embudo</h2>
            <ol className="mt-4 divide-y divide-border border-y border-border">
              {funnel.map(([label, n]) => (
                <li key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span>{label}</span>
                  <span className="tabular-nums text-muted-foreground"><strong className="text-foreground">{n}</strong> · {pct(n, abrieron)}%</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">Prompts promedio en la demo: {avg(demo.map((r) => r.demo_prompts ?? 0)).toFixed(1)}</p>
          </section>
          <section className="grid gap-6">
            <Breakdown title="IAs marcadas como desperdiciadas" items={tally(rows.flatMap((r) => r.ias_pagadas?.split(", ") ?? []))} />
            <Breakdown title="IA recomendada" items={tally(rows.map((r) => r.herramienta_recomendada))} />
            <Breakdown title="Motivo para no elegir pack" items={tally(rows.map((r) => r.motivo_sin_pack))} />
          </section>
        </div>

        <h2 className="mt-10 text-lg font-semibold">Últimas sesiones</h2>
        <div className="mt-4 overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-surface text-muted-foreground">
              <tr>{["Fecha", "Paso", "IAs pagadas", "Gasto USD", "Meses", "IA recomendada", "Correo", "Prompts", "Pack", "Motivo"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.slice(0, 100).map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2">{r.fecha ? new Date(r.fecha).toLocaleString("es-CO") : ""}</td>
                  <td className="px-3 py-2">{r.paso}</td>
                  <td className="px-3 py-2">{r.ias_pagadas}</td>
                  <td className="px-3 py-2 tabular-nums">{r.gasto_usd}</td>
                  <td className="px-3 py-2 tabular-nums">{r.meses_sin_uso ?? ""}</td>
                  <td className="px-3 py-2">{r.herramienta_recomendada}</td>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2 tabular-nums">{r.demo_prompts}</td>
                  <td className="px-3 py-2">{r.pack_elegido}</td>
                  <td className="px-3 py-2">{r.motivo_sin_pack}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">La tabla muestra las 100 más recientes; el CSV incluye todas las columnas (respuestas y conversación de la demo).</p>
      </div>
    </main>
  );
}

function Stat({ label, value, sub, meta, actual }: { label: string; value: string; sub: string; meta?: number; actual?: number }) {
  const ok = meta !== undefined && actual !== undefined && actual >= meta;
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      {meta !== undefined && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold">
          {ok ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <XCircle className="size-4 text-muted-foreground" aria-hidden />}
          Meta ≥ {meta}% · {ok ? "Cumplida" : "Aún no"}
        </p>
      )}
    </div>
  );
}

function Breakdown({ title, items }: { title: string; items: [string, number][] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length ? (
        <ul className="mt-2 grid gap-1 text-sm">
          {items.map(([k, n]) => (
            <li key={k} className="flex justify-between gap-4 border-b border-border py-1"><span>{k}</span><span className="tabular-nums text-muted-foreground">{n}</span></li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Sin datos todavía.</p>
      )}
    </div>
  );
}
