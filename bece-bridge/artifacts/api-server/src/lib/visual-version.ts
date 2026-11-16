import { createHash } from "node:crypto";
import { visualModels, calculateVisual } from "./visual-models";
import { calculateRecipe } from "./visual-recipes";
import { evaluator, parseExpression } from "./visual-expressions";
import { ComputeVisualBody } from "@workspace/api-zod";
import { calculateDiagram, diagramModels, validateDiagram } from "./engineering-diagrams";

// Fail closed when model metadata, controls, evaluator or engine changes.
export function visualVersion(model: string): string {
  if (Object.hasOwn(diagramModels, model)) return createHash("sha256").update(
    JSON.stringify(diagramModels[model], (_key, value) => typeof value === "function" ? value.toString() : value)
    + calculateDiagram.toString() + validateDiagram.toString()
  ).digest("hex");
  if (model === "custom") return createHash("sha256").update(
    calculateRecipe.toString() + evaluator.toString() + parseExpression.toString()
    + JSON.stringify(ComputeVisualBody.shape.recipe)
  ).digest("hex");
  if (!Object.hasOwn(visualModels, model)) return "unsupported";
  return createHash("sha256").update(JSON.stringify(visualModels[model],
    (_key, value) => typeof value === "function" ? value.toString() : value
  ) + calculateVisual.toString()).digest("hex");
}
