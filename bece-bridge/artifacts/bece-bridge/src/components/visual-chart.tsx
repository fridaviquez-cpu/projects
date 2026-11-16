import { useMemo, useRef, useState } from "react";
import { CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import type { VisualPanel, VisualResult } from "@workspace/api-client-react";
import { btnGhost } from "@/components/kit";
import { EngineeringDiagram } from "@/components/engineering-diagram";

const COLORS = ["hsl(var(--accent))", "hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];
/** Models with discrete inputs: logic is a truth table (scatter/step), array is per-index addresses (scatter). */
const DISCRETE = new Set(["logic", "array"]);

const fmt = (n: number) => (Math.abs(n) >= 1e4 || (Math.abs(n) < 1e-3 && n !== 0) ? n.toExponential(3) : Number(n.toFixed(4)).toString());

/** Renders recipe panels when present; otherwise the legacy single-series preset chart. */
export function VisualChart({ result }: { result: VisualResult }) {
  if (result.diagram) return <EngineeringDiagram result={{ ...result, diagram: result.diagram }} />;
  if (result.panels?.length) {
    return <div className="space-y-8">{result.panels.map((p, i) => <PanelChart key={i} panel={p} index={i} fileBase={`${result.model}-${result.courseId}`} />)}</div>;
  }
  return <LegacyChart result={result} />;
}

function downloadSvg(root: HTMLElement | null, name: string) {
  const svg = root?.querySelector("svg.recharts-surface");
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([clone.outerHTML], { type: "image/svg+xml" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** One recipe panel. Each series keeps its own x coordinates; "points" series are never interpolated. */
function PanelChart({ panel, index, fileBase }: { panel: VisualPanel; index: number; fileBase: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [table, setTable] = useState(false);
  const series = panel.series.map((s, i) => ({ ...s, color: COLORS[i % COLORS.length], data: s.points.map((p) => ({ x: p.x, y: p.y })) }));
  const thin = (n: number) => (n <= 60 ? 1 : Math.ceil(n / 50));
  return (
    <figure data-testid={`panel-visual-${index}`}>
      <figcaption className="text-sm font-semibold mb-1">{panel.title}</figcaption>
      <div ref={wrap} className="h-72 w-full" role="img" aria-label={`${panel.title}: ${panel.yLabel} versus ${panel.xLabel}. Series: ${panel.series.map((s) => `${s.name} (${s.mode === "points" ? "discrete points" : "line"})`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 10, right: 16, bottom: 28, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" dataKey="x" domain={["dataMin", "dataMax"]} tickFormatter={fmt} fontSize={11} allowDuplicatedCategory={false}
              label={{ value: panel.xLabel, position: "insideBottom", offset: -16, fontSize: 11 }} />
            <YAxis type="number" dataKey="y" fontSize={11} width={60} tickFormatter={fmt} domain={["auto", "auto"]}
              label={{ value: panel.yLabel, angle: -90, position: "insideLeft", fontSize: 11 }} />
            <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(x: number) => `${panel.xLabel}: ${fmt(x)}`} />
            <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, whiteSpace: "normal" }} />
            {series.map((s) => s.mode === "points"
              ? <Scatter key={s.name} name={s.name} data={s.data} dataKey="y" fill={s.color} legendType="circle" isAnimationActive={false} />
              : <Line key={s.name} name={s.name} data={s.data} dataKey="y" type="linear" dot={false} stroke={s.color} strokeWidth={2} legendType="line" isAnimationActive={false} />)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTable((t) => !t)} aria-expanded={table} className={`${btnGhost} py-1.5 text-xs`} data-testid={`button-toggle-table-${index}`}>{table ? "Hide data table" : "Show data table"}</button>
        <button type="button" onClick={() => downloadSvg(wrap.current, `${fileBase}-panel${index + 1}.svg`)} className={`${btnGhost} py-1.5 text-xs`} data-testid={`button-export-svg-${index}`}><Download className="h-3.5 w-3.5" /> Export SVG</button>
      </div>
      {table && (
        <div className="mt-3 max-h-72 overflow-auto rounded-md border space-y-3 p-2" data-testid={`table-visual-${index}`}>
          {series.map((s) => {
            const k = thin(s.data.length);
            const rows = s.data.filter((_, i) => i % k === 0 || i === s.data.length - 1);
            return (
              <table key={s.name} className="w-full text-xs font-mono">
                <caption className="text-left font-sans font-medium py-1">{s.name} ({s.mode === "points" ? "discrete" : "line"}){k > 1 ? ` · showing ${rows.length} of ${s.data.length} points` : ""}</caption>
                <thead className="bg-muted"><tr><th scope="col" className="p-1.5 text-left">{panel.xLabel}</th><th scope="col" className="p-1.5 text-left">{panel.yLabel}</th></tr></thead>
                <tbody>{rows.map((r, i) => <tr key={i} className="border-t"><td className="p-1.5">{fmt(r.x)}</td><td className="p-1.5">{fmt(r.y)}</td></tr>)}</tbody>
              </table>
            );
          })}
        </div>
      )}
    </figure>
  );
}

function LegacyChart({ result }: { result: VisualResult }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [table, setTable] = useState(false);
  const discrete = DISCRETE.has(result.model);
  const rows = useMemo(() => {
    const xs = result.series[0]?.points.map((p) => p.x) ?? [];
    return xs.map((x, i) => ({ x, ...Object.fromEntries(result.series.map((s) => [s.name, s.points[i]?.y])) }));
  }, [result]);
  const tableRows = useMemo(() => {
    if (rows.length <= 60) return rows;
    const step = Math.ceil(rows.length / 50);
    return rows.filter((_, i) => i % step === 0 || i === rows.length - 1);
  }, [rows]);
  const xTick = result.model === "logic" ? (v: number) => ["00", "01", "10", "11"][v] ?? String(v) : fmt;

  const exportSvg = () => downloadSvg(wrap.current, `${result.model}-ece${result.courseId}.svg`);

  return (
    <div>
      <div ref={wrap} className="h-72 w-full" data-testid="chart-visual" role="img" aria-label={`${result.title}: ${result.yLabel} versus ${result.xLabel}`}>
        <ResponsiveContainer width="100%" height="100%">
          {discrete ? (
            <ScatterChart margin={{ top: 10, right: 16, bottom: 28, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" dataKey="x" tickFormatter={xTick} ticks={result.series[0]?.points.map((p) => p.x)} domain={["dataMin", "dataMax"]} fontSize={11}
                label={{ value: result.xLabel, position: "insideBottom", offset: -16, fontSize: 11 }} />
              <YAxis type="number" dataKey="y" fontSize={11} width={60} tickFormatter={fmt} ticks={result.model === "logic" ? [0, 1] : undefined} domain={result.model === "logic" ? [-0.2, 1.2] : ["auto", "auto"]}
                label={{ value: result.yLabel, angle: -90, position: "insideLeft", fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={() => ""} />
              <Legend verticalAlign="top" height={24} />
              {result.series.map((s, i) => (
                <Scatter key={s.name} name={s.name} data={s.points.map((p) => ({ x: p.x + (result.model === "logic" ? (i - (result.series.length - 1) / 2) * 0.08 : 0), y: p.y }))}
                  fill={COLORS[i % COLORS.length]} line={result.model === "logic" ? { strokeDasharray: "2 3" } : false} lineType="joint" isAnimationActive={false} />
              ))}
            </ScatterChart>
          ) : (
            <LineChart data={rows} margin={{ top: 10, right: 16, bottom: 28, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" dataKey="x" domain={["dataMin", "dataMax"]} tickFormatter={fmt} fontSize={11}
                label={{ value: result.xLabel, position: "insideBottom", offset: -16, fontSize: 11 }} />
              <YAxis fontSize={11} width={60} tickFormatter={fmt} label={{ value: result.yLabel, angle: -90, position: "insideLeft", fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(x: number) => `${result.xLabel}: ${fmt(x)}`} />
              {result.series.length > 1 && <Legend verticalAlign="top" height={24} />}
              {result.series.map((s, i) => <Line key={s.name} dataKey={s.name} type="linear" dot={false} stroke={COLORS[i % COLORS.length]} strokeWidth={2} isAnimationActive={false} />)}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {result.model === "logic" && <p className="text-[11px] text-muted-foreground">Discrete points only; dotted links just connect the four input cases. Series are offset slightly so overlapping outputs stay visible.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTable((t) => !t)} aria-expanded={table} className={`${btnGhost} py-1.5 text-xs`} data-testid="button-toggle-table">{table ? "Hide data table" : "Show data table"}</button>
        <button type="button" onClick={exportSvg} className={`${btnGhost} py-1.5 text-xs`} data-testid="button-export-svg"><Download className="h-3.5 w-3.5" /> Export SVG</button>
      </div>
      {table && (
        <div className="mt-3 max-h-72 overflow-auto rounded-md border" data-testid="table-visual">
          <table className="w-full text-xs font-mono">
            <caption className="sr-only">Plotted points for {result.title}{tableRows.length < rows.length ? ` (every ${Math.ceil(rows.length / 50)}th of ${rows.length} points)` : ""}</caption>
            <thead className="sticky top-0 bg-muted"><tr><th scope="col" className="p-2 text-left">{result.xLabel}</th>{result.series.map((s) => <th key={s.name} scope="col" className="p-2 text-left">{s.name} · {result.yLabel}</th>)}</tr></thead>
            <tbody>{tableRows.map((r) => (
              <tr key={r.x} className="border-t"><td className="p-2">{result.model === "logic" ? `${xTick(r.x)} (${r.x})` : fmt(r.x)}</td>{result.series.map((s) => <td key={s.name} className="p-2">{fmt((r as Record<string, number>)[s.name])}</td>)}</tr>
            ))}</tbody>
          </table>
          {tableRows.length < rows.length && <p className="p-2 text-[11px] text-muted-foreground">Showing {tableRows.length} of {rows.length} sampled points.</p>}
        </div>
      )}
    </div>
  );
}
