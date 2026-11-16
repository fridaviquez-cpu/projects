export type Bit = 0 | 1;
export type Gate = "AND" | "OR" | "XOR" | "NOT";
export const GATES: Gate[] = ["AND", "OR", "XOR", "NOT"];
export const isBit = (x: unknown): x is Bit => x === 0 || x === 1;

/** Ideal combinational gate. NOT ignores b. Throws on non-bit inputs. */
export function evalGate(g: Gate, a: Bit, b: Bit = 0): Bit {
  if (!isBit(a) || !isBit(b)) throw new Error("Inputs must be 0 or 1");
  switch (g) {
    case "AND": return (a & b) as Bit;
    case "OR": return (a | b) as Bit;
    case "XOR": return (a ^ b) as Bit;
    case "NOT": return (a ? 0 : 1) as Bit;
    default: throw new Error("Unknown gate");
  }
}

export function truthTable(g: Gate): { a: Bit; b: Bit; out: Bit }[] {
  const rows: { a: Bit; b: Bit; out: Bit }[] = [];
  const bs: Bit[] = g === "NOT" ? [0] : [0, 1];
  for (const a of [0, 1] as Bit[]) for (const b of bs) rows.push({ a, b, out: evalGate(g, a, b) });
  return rows;
}
