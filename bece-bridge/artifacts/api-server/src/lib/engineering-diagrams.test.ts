import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateDiagram, diagramModels, validateDiagram } from "./engineering-diagrams";
import { calculateVisual } from "./visual-models";
import { ComputeVisualResponse } from "@workspace/api-zod";

test("circuit benchmark: actual series netlist, polarity, ground and divider equation", () => {
  const r = calculateDiagram("391", "circuit-divider", { vin: 12, r1: 2, r2: 4 });
  assert.equal(r.diagram.kind, "circuit");
  assert.deepEqual(r.diagram.edges.map(e => [e.id, e.from, e.to, e.kind]), [
    ["source", "return", "vin", "voltage-source"],
    ["r1", "vin", "out", "resistor"],
    ["r2", "out", "gnd", "resistor"],
    ["return-wire", "gnd", "return", "wire"],
  ]);
  assert.equal(r.diagram.nodes.find(n => n.id === "gnd")?.kind, "ground");
  assert.match(r.diagram.description, /Vout = 8 V; series current = 2 mA/);
  const changed = calculateDiagram("110", "circuit-divider", { vin: 5, r1: 1, r2: 1 });
  assert.match(changed.diagram.description, /Vout = 2.5 V; series current = 2.5 mA/);
});

test("signal-flow benchmark: negative feedback direction, gains and closed-loop result", () => {
  const d = calculateDiagram("220", "feedback-flow", { g: 4, h: 0.5 }).diagram;
  assert.deepEqual(d.edges.map(e => [e.from, e.to, e.sign ?? ""]), [
    ["r", "sum", "positive"], ["sum", "forward", ""], ["forward", "y", ""],
    ["y", "feedback", ""], ["feedback", "sum", "negative"],
  ]);
  assert.match(d.description, /gain = 1.3333/);
  assert.match(calculateDiagram("120", "feedback-flow", { g: 4, h: 0 }).diagram.description, /gain = 4/);
});

test("state-machine benchmark: all moduli, one initial state, complete deterministic wrap", () => {
  for (let n = 2; n <= 6; n++) {
    const d = calculateDiagram("110", "counter-fsm", { n }).diagram;
    assert.equal(d.nodes.length, n);
    assert.equal(d.edges.length, n);
    assert.deepEqual(d.nodes.filter(v => v.initial).map(v => v.id), ["q0"]);
    for (let i = 0; i < n; i++) {
      assert.deepEqual(d.edges.filter(e => e.from === `q${i}`).map(e => [e.to, e.label]), [[`q${(i + 1) % n}`, "clk ↑"]]);
    }
    if (n === 2) assert.ok(d.edges.every(e => e.bend)); // reverse arrows must not overlap
  }
});

test("diagram controls: course independence, schema roundtrip, defaults, bounds and malicious keys", () => {
  for (const [id, model] of Object.entries(diagramModels)) {
    for (const course of ["110", "120", "210", "220", "391", "future-course"]) {
      const r = calculateVisual(course, id);
      assert.equal(r.courseId, course);
      assert.equal(r.series.length, 0);
      assert.deepEqual(ComputeVisualResponse.parse(r), r);
      assert.deepEqual(r.diagram, calculateDiagram("110", id).diagram);
    }
    for (const bound of ["min", "max"] as const) {
      assert.ok(calculateDiagram("210", id, Object.fromEntries(model.controls.map(c => [c.key, c[bound]]))).diagram);
    }
    for (const c of model.controls) {
      for (const value of [c.min - 1, c.max + 1, NaN, Infinity]) assert.throws(() => calculateDiagram("110", id, { [c.key]: value }));
    }
    assert.throws(() => calculateDiagram("110", id, { svg: 1 }));
    assert.throws(() => calculateDiagram("110", id, JSON.parse('{"__proto__": 1}')));
  }
  assert.throws(() => calculateDiagram("110", "counter-fsm", { n: 2.5 }));
  assert.throws(() => calculateVisual("110", "arbitrary-fsm"));
  assert.throws(() => calculateVisual("110", "__proto__"));
});

test("declarative schema rejects invalid topology, unsafe primitive kinds and unbounded geometry", () => {
  const original = calculateDiagram("110", "counter-fsm").diagram;
  const mutate = (fn: (d: any) => void) => {
    const d = structuredClone(original); fn(d);
    assert.throws(() => validateDiagram(d));
  };
  mutate(d => { d.nodes[0].kind = "script"; });
  mutate(d => { d.nodes[0].x = Infinity; });
  mutate(d => { d.nodes[0].x = -1; });
  mutate(d => { d.nodes[0].label = "x".repeat(101); });
  mutate(d => { d.nodes[1].id = d.nodes[0].id; });
  mutate(d => { d.edges[0].to = "missing"; });
  mutate(d => { d.edges[0].kind = "wire"; });
  mutate(d => { d.edges[0].sign = "negative"; });
  mutate(d => { d.nodes[1].initial = true; });
  mutate(d => { d.edges.pop(); });
});
