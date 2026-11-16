import { useId, useRef } from "react";
import { Download } from "lucide-react";
import type { EngineeringDiagram as Diagram, DiagramNode, VisualResult } from "@workspace/api-client-react";
import { btnGhost } from "@/components/kit";

const radius = (n: DiagramNode) => n.kind === "state" ? 32 : n.kind === "sum" ? 22 : n.kind === "gain" ? 49 : 8;

/** All paths and symbols are authored here. Diagram labels are escaped React text. */
export function DiagramSvg({ diagram, title }: { diagram: Diagram; title: string }) {
  const marker = `arrow-${useId().replace(/:/g, "")}`;
  const nodes = new Map(diagram.nodes.map(n => [n.id, n]));
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 480" className="w-full h-auto" role="img" aria-label={title} style={{ background: "white", color: "#172b3a" }}>
    <title>{title}</title><desc>{diagram.description}</desc>
    <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#172b3a" /></marker></defs>
    {diagram.edges.map(e => {
      const a = nodes.get(e.from), b = nodes.get(e.to);
      if (!a || !b) return null;
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
      if (!length) return null;
      const ux = dx / length, uy = dy / length;
      const circuit = diagram.kind === "circuit";
      const start = circuit ? 0 : radius(a), end = circuit ? 0 : radius(b);
      const x1 = a.x + ux * start, y1 = a.y + uy * start, x2 = b.x - ux * end, y2 = b.y - uy * end;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, bend = e.bend ?? 0;
      const cx = mx - uy * bend, cy = my + ux * bend;
      const component = e.kind === "resistor" || e.kind === "voltage-source";
      return <g key={e.id} stroke="#172b3a" strokeWidth="2" fill="none">
        {component ? <g transform={`translate(${mx} ${my}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`}>
          <path d={`M ${-length / 2} 0 H -25 M 25 0 H ${length / 2}`} />
          {e.kind === "resistor" ? <path d="M -25 0 L -20 -9 L -12 9 L -4 -9 L 4 9 L 12 -9 L 20 9 L 25 0" /> : <>
            <circle r="25" fill="white" /><path d="M 9 -5 V 5 M 4 0 H 14 M -14 0 H -4" />
          </>}
        </g> : <path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} markerEnd={circuit ? undefined : `url(#${marker})`} />}
        {e.label && <text x={mx - uy * bend / 2 + (Math.abs(dy) > Math.abs(dx) && circuit ? 38 : 0)} y={my + ux * bend / 2 - (circuit ? 18 : 14)} textAnchor={Math.abs(dy) > Math.abs(dx) && circuit ? "start" : "middle"} fill="#172b3a" stroke="white" strokeWidth="5" paintOrder="stroke" fontSize="15">{e.label}</text>}
        {e.sign && <text x={x2 - ux * 16 - uy * 15} y={y2 - uy * 16 + ux * 15} textAnchor="middle" fill="#172b3a" stroke="white" strokeWidth="4" paintOrder="stroke" fontSize="20">{e.sign === "negative" ? "−" : "+"}</text>}
      </g>;
    })}
    {diagram.nodes.map(n => <g key={n.id} transform={`translate(${n.x} ${n.y})`} stroke="#172b3a" strokeWidth="2">
      {n.kind === "gain" ? <rect x="-47" y="-24" width="94" height="48" rx="4" fill="#eef6f5" />
        : n.kind === "state" || n.kind === "sum" ? <circle r={radius(n)} fill="#eef6f5" />
        : <circle r="4" fill="#172b3a" />}
      {n.kind === "ground" && <path d="M 0 0 V 12 M -18 12 H 18 M -12 18 H 12 M -6 24 H 6" fill="none" />}
      {n.initial && <><path d="M -72 0 H -35" fill="none" markerEnd={`url(#${marker})`} /><text x="-73" y="-10" textAnchor="middle" stroke="none" fill="#172b3a" fontSize="13">start</text></>}
      <text x="0" y={["gain", "state", "sum"].includes(n.kind) ? 5 : n.kind === "ground" ? 45 : -18} textAnchor="middle" stroke="none" fill="#172b3a" fontSize="16">{n.label}</text>
    </g>)}
  </svg>;
}

export function EngineeringDiagram({ result }: { result: VisualResult & { diagram: Diagram } }) {
  const wrap = useRef<HTMLDivElement>(null);
  const diagram = result.diagram;
  const labels = new Map(diagram.nodes.map(n => [n.id, n.label || n.id]));
  const exportSvg = () => {
    const svg = wrap.current?.querySelector("svg");
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
    const link = document.createElement("a");
    link.href = url; link.download = `${result.model}.svg`; link.click();
    URL.revokeObjectURL(url);
  };
  return <div data-testid="engineering-diagram">
    <div className="overflow-x-auto rounded border bg-white" ref={wrap}>
      <div className="min-w-[540px]"><DiagramSvg diagram={diagram} title={result.title} /></div>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">{diagram.description}</p>
    <button type="button" onClick={exportSvg} className={`${btnGhost} mt-3 py-1.5 text-xs`} data-testid="button-export-svg"><Download className="h-3.5 w-3.5" />Export SVG</button>
    <details className="mt-3 text-xs" data-testid="diagram-connections">
      <summary className="cursor-pointer">Connections / transitions</summary>
      <ul className="mt-2 space-y-1">{diagram.edges.map(e => <li key={e.id}>{labels.get(e.from)} {diagram.kind === "circuit" ? "—" : "→"} {labels.get(e.to)}: {e.label || e.kind}{e.sign ? ` (${e.sign} input)` : ""}</li>)}</ul>
    </details>
  </div>;
}
