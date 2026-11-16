import assert from "node:assert/strict";
import { visualVersion } from "./visual-version";
import { calculateVisual, visualModels } from "./visual-models";
import { calculateRecipe } from "./visual-recipes";
import { diagramModels } from "./engineering-diagrams";

const original = visualVersion("rc");
assert.equal(original, visualVersion("rc"));
assert.equal(visualVersion("removed-model"), "unsupported");
assert.equal(visualVersion("__proto__"), "unsupported");
for (const model of Object.keys(diagramModels)) {
  assert.notEqual(visualVersion(model), "unsupported");
  const snapshot = JSON.parse(JSON.stringify(calculateVisual("210", model)));
  assert.ok(snapshot.diagram);
  assert.deepEqual(calculateVisual("210", model,
    Object.fromEntries(snapshot.controls.map((c: { key: string; value: number }) => [c.key, c.value]))), snapshot);
  const version = visualVersion(model);
  const assumption = diagramModels[model]!.assumptions;
  try {
    diagramModels[model]!.assumptions += " Changed.";
    assert.notEqual(visualVersion(model), version);
  } finally { diagramModels[model]!.assumptions = assumption; }
}
assert.notEqual(visualVersion("custom"), "unsupported");
assert.equal(visualVersion("custom"), visualVersion("custom"));
const recipe = { title: "Scale", explanation: "Linear scaling", assumptions: "Dimensionless",
  controls: [{ key: "a", label: "Scale", unit: "", min: 1, max: 4, step: 1, value: 2 }],
  plots: [{ title: "Scale", xLabel: "x", yLabel: "y",
    curves: [{ name: "y", expression: "a*x", min: "0", max: "2", samples: "3", mode: "line" }] }] };
const customSnapshot = JSON.parse(JSON.stringify(calculateRecipe("210", recipe)));
const editedCustom = calculateRecipe(customSnapshot.courseId, customSnapshot.recipe, { a: 3 });
assert.equal(editedCustom.series[0]!.points[2]!.y, 6);
assert.deepEqual(editedCustom.recipe, customSnapshot.recipe);
const model = visualModels.rc!;
const assumptions = model.assumptions;
const control = model.controls[0]!;
const max = control.max;
const evaluate = model.lines[0]!.evaluate;
try {
  model.assumptions += " Revised.";
  assert.notEqual(visualVersion("rc"), original, "Changed assumptions invalidate editing");
  model.assumptions = assumptions;
  control.max += 1;
  assert.notEqual(visualVersion("rc"), original, "Changed parameter schema invalidates editing");
  control.max = max;
  model.lines[0]!.evaluate = () => 0;
  assert.notEqual(visualVersion("rc"), original, "Changed mathematics invalidates editing");
} finally {
  model.assumptions = assumptions;
  control.max = max;
  model.lines[0]!.evaluate = evaluate;
}
assert.equal(visualVersion("rc"), original);
const snapshot = calculateVisual("210", "rc", { r: 3, cap: 20, v: 6 });
const reopened = JSON.parse(JSON.stringify(snapshot));
assert.deepEqual(reopened, snapshot, "Persisted snapshot retains assumptions, parameters and exact plot");
assert.deepEqual(calculateVisual(reopened.courseId, reopened.model,
  Object.fromEntries(reopened.controls.map((c: { key: string; value: number }) => [c.key, c.value]))), snapshot);
console.log("Visual version and snapshot round-trip checks passed.");
