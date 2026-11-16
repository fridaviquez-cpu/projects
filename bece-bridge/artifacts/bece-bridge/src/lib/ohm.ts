export const OHM_LIMITS = { v: { min: 0, max: 48 }, r: { min: 0.1, max: 100 } } as const;
export type OhmInput = { v: number; rK: number };
export type OhmResult =
  | { ok: true; iMa: number; pMw: number }
  | { ok: false; errors: Partial<Record<keyof OhmInput, string>> };

/** Ideal Ohm's law for one linear resistor. V in volts, R in kOhm. I = V/R in mA, P = V*I in mW. */
export function solveOhm(input: OhmInput): OhmResult {
  const errors: Partial<Record<keyof OhmInput, string>> = {};
  const check = (k: keyof OhmInput, min: number, max: number, unit: string) => {
    const x = input[k];
    if (typeof x !== "number" || !Number.isFinite(x)) errors[k] = "Enter a number";
    else if (x < min || x > max) errors[k] = `Must be ${min} to ${max} ${unit}`;
  };
  check("v", OHM_LIMITS.v.min, OHM_LIMITS.v.max, "V");
  check("rK", OHM_LIMITS.r.min, OHM_LIMITS.r.max, "kΩ");
  if (Object.keys(errors).length) return { ok: false, errors };
  const iMa = input.v / input.rK;
  return { ok: true, iMa, pMw: input.v * iMa };
}
