import { GenerateVisualResponse, type EngineeringDiagram, type DiagramNode, type DiagramEdge, type VisualControl } from "@workspace/api-zod";

type Values = Record<string, number>;
type DiagramModel = {
  title: string; formula: string; assumptions: string; controls: VisualControl[];
  build: (p: Values) => EngineeringDiagram;
};
const control = (key: string, label: string, unit: string, min: number, max: number, step: number, value: number): VisualControl =>
  ({ key, label, unit, min, max, step, value });
const node = (id: string, label: string, kind: DiagramNode["kind"], x: number, y: number): DiagramNode => ({ id, label, kind, x, y });
const edge = (id: string, from: string, to: string, kind: DiagramEdge["kind"], label = ""): DiagramEdge => ({ id, from, to, kind, label });
const fmt = (v: number) => Number(v.toPrecision(5)).toString();

/** Trusted templates only. AI selects a model and bounded numbers, never topology or markup. */
export const diagramModels: Record<string, DiagramModel> = {
  "circuit-divider": {
    title: "Unloaded resistor-divider circuit schematic",
    formula: "Vout = Vin × R2/(R1 + R2); I = Vin/(R1 + R2)",
    assumptions: "Ideal DC voltage source and two positive series resistors. Output measured across R2 relative to ground, with no load. Fixed topology; not an arbitrary circuit solver.",
    controls: [control("vin", "Input voltage", "V", 0, 24, 0.1, 12), control("r1", "Upper resistance R1", "kΩ", 0.1, 100, 0.1, 2), control("r2", "Lower resistance R2", "kΩ", 0.1, 100, 0.1, 4)],
    build: p => ({
      kind: "circuit",
      description: `Vin positive terminal connects through R1 to Vout, then R2 to ground. Source negative terminal is grounded. Vout = ${fmt(p.vin! * p.r2! / (p.r1! + p.r2!))} V; series current = ${fmt(p.vin! / (p.r1! + p.r2!))} mA.`,
      nodes: [node("vin", "Vin", "junction", 180, 100), node("out", `Vout = ${fmt(p.vin! * p.r2! / (p.r1! + p.r2!))} V`, "junction", 520, 100), node("return", "", "junction", 180, 360), node("gnd", "0 V", "ground", 520, 360)],
      edges: [edge("source", "return", "vin", "voltage-source", `Vin = ${p.vin} V`), edge("r1", "vin", "out", "resistor", `R1 = ${p.r1} kΩ`), edge("r2", "out", "gnd", "resistor", `R2 = ${p.r2} kΩ`), edge("return-wire", "gnd", "return", "wire")],
    }),
  },
  "feedback-flow": {
    title: "Negative-feedback signal-flow diagram",
    formula: "e = r − H y; y = G e; y/r = G/(1 + GH)",
    assumptions: "Single negative-feedback loop with constant nonnegative scalar gains G and H. Arrows show signal direction; signs apply at the summing node. No dynamics, poles, stability analysis or arbitrary transfer functions.",
    controls: [control("g", "Forward gain G", "", 0, 100, 0.1, 4), control("h", "Feedback gain H", "", 0, 10, 0.1, 1)],
    build: p => ({
      kind: "signal-flow", description: `Reference r enters the positive sum input. Feedback H y enters the negative sum input. Forward gain G produces y. Closed-loop gain = ${fmt(p.g! / (1 + p.g! * p.h!))}.`,
      nodes: [node("r", "r", "input", 70, 140), node("sum", "Σ", "sum", 240, 140), node("forward", `G = ${p.g}`, "gain", 450, 140), node("y", "y", "output", 680, 140), node("feedback", `H = ${p.h}`, "gain", 450, 350)],
      edges: [{ ...edge("reference", "r", "sum", "signal", "r"), sign: "positive" }, edge("error", "sum", "forward", "signal", "e"), edge("forward-output", "forward", "y", "signal", "y"), edge("sense", "y", "feedback", "signal", "y"), { ...edge("feedback-input", "feedback", "sum", "signal", "H y"), sign: "negative" }],
    }),
  },
  "counter-fsm": {
    title: "Modulo-counter state-machine diagram",
    formula: "q(next) = (q + 1) mod N on each rising clock edge",
    assumptions: "Deterministic modulo-N counter, 2–6 states, initialized to q=0. Each arrow is one rising clock event; state output equals its numeric index. No enable, reset input, timing delays, custom guards or arbitrary FSM synthesis.",
    controls: [control("n", "State count N", "states", 2, 6, 1, 4)],
    build: p => {
      const n = p.n!;
      return {
        kind: "state-machine", description: `${n} states, initial state q0. Every rising clock edge increments the state, wrapping from q${n - 1} to q0. Output equals state index.`,
        nodes: Array.from({ length: n }, (_, i) => {
          const angle = -Math.PI / 2 + i * 2 * Math.PI / n;
          return { ...node(`q${i}`, `q${i} / ${i}`, "state", 380 + 245 * Math.cos(angle), 240 + 155 * Math.sin(angle)), initial: i === 0 };
        }),
        edges: Array.from({ length: n }, (_, i) => ({ ...edge(`tick${i}`, `q${i}`, `q${(i + 1) % n}`, "transition", "clk ↑"), bend: n === 2 ? 85 : 0 })),
      };
    },
  },
};

/** Schema validation plus referential and representation-specific invariants. */
export function validateDiagram(raw: unknown): EngineeringDiagram {
  const d = GenerateVisualResponse.shape.diagram.unwrap().parse(raw);
  const ids = new Set(d.nodes.map(n => n.id));
  if (ids.size !== d.nodes.length || new Set(d.edges.map(e => e.id)).size !== d.edges.length) throw new Error("Duplicate diagram identifiers.");
  const kinds = d.kind === "circuit" ? ["junction", "ground"] : d.kind === "signal-flow" ? ["input", "output", "sum", "gain"] : ["state"];
  const edges = d.kind === "circuit" ? ["wire", "resistor", "voltage-source"] : d.kind === "signal-flow" ? ["signal"] : ["transition"];
  if (d.nodes.some(n => !kinds.includes(n.kind) || !Number.isFinite(n.x) || !Number.isFinite(n.y))) throw new Error("Invalid diagram nodes.");
  for (const e of d.edges) {
    if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to || !edges.includes(e.kind)) throw new Error("Invalid diagram connection.");
    if (e.sign && (d.kind !== "signal-flow" || d.nodes.find(n => n.id === e.to)?.kind !== "sum")) throw new Error("Sign must terminate at a sum.");
  }
  if (d.kind === "circuit" && !d.nodes.some(n => n.kind === "ground")) throw new Error("Circuit requires ground.");
  if (d.kind === "state-machine" && (d.nodes.filter(n => n.initial).length !== 1 || d.nodes.some(n => d.edges.filter(e => e.from === n.id).length !== 1))) throw new Error("Counter requires one initial state and one outgoing transition per state.");
  return d;
}

export function calculateDiagram(courseId: string, model: string, values: Values = {}) {
  const m = Object.hasOwn(diagramModels, model) ? diagramModels[model] : undefined;
  if (!m) throw new Error("Unsupported diagram model.");
  if (Object.keys(values).some(k => !m.controls.some(c => c.key === k))) throw new Error("Unknown diagram parameter.");
  const controls = m.controls.map(c => {
    const value = values[c.key] ?? c.value;
    if (!Number.isFinite(value) || value < c.min || value > c.max || (c.step === 1 && !Number.isInteger(value))) throw new Error(`Invalid ${c.label}: expected ${c.min}–${c.max}${c.step === 1 ? " (integer)" : ""}.`);
    return { ...c, value };
  });
  const diagram = validateDiagram(m.build(Object.fromEntries(controls.map(c => [c.key, c.value]))));
  return { courseId, model, title: m.title, formula: m.formula, assumptions: m.assumptions, controls, series: [], xLabel: "", yLabel: "", diagram };
}
