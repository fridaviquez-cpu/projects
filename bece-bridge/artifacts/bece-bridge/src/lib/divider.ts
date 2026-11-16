export const DIVIDER_LIMITS = { vs: { min: 1, max: 24 }, r: { min: 1, max: 20 } } as const;

export type DividerInput = { vs: number; r1: number; r2: number };
export type DividerResult =
  | { ok: true; iMa: number; v1: number; v2: number; pMw: number }
  | { ok: false; errors: Partial<Record<keyof DividerInput, string>> };

/** Series voltage divider. Vs in V, R1/R2 in kOhm. V / kOhm = mA, V * mA = mW. */
export function solveDivider(input: DividerInput): DividerResult {
  const errors: Partial<Record<keyof DividerInput, string>> = {};
  const check = (k: keyof DividerInput, min: number, max: number, unit: string) => {
    const v = input[k];
    if (typeof v !== "number" || !Number.isFinite(v)) errors[k] = "Enter a number";
    else if (v < min || v > max) errors[k] = `Must be ${min} to ${max} ${unit}`;
  };
  check("vs", DIVIDER_LIMITS.vs.min, DIVIDER_LIMITS.vs.max, "V");
  check("r1", DIVIDER_LIMITS.r.min, DIVIDER_LIMITS.r.max, "kΩ");
  check("r2", DIVIDER_LIMITS.r.min, DIVIDER_LIMITS.r.max, "kΩ");
  if (Object.keys(errors).length) return { ok: false, errors };
  const { vs, r1, r2 } = input;
  const iMa = vs / (r1 + r2);
  return { ok: true, iMa, v1: iMa * r1, v2: iMa * r2, pMw: vs * iMa };
}
