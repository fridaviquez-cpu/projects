export const SIGNAL_LIMITS = { a: { min: 0, max: 5 }, f: { min: 1, max: 10 }, phase: { min: -180, max: 180 } } as const;
export const SIGNAL_SAMPLES = 401;
export const SIGNAL_DURATION = 1;

export type SignalInput = { a: number; f: number; phase: number };
export type SignalPoint = { t: number; v: number };
export type SignalResult =
  | { ok: true; points: SignalPoint[]; periodS: number }
  | { ok: false; errors: Partial<Record<keyof SignalInput, string>> };

/** v(t) = A sin(2 pi f t + phase), A in V, f in Hz, phase in degrees, t in s. */
export function sinusoid(a: number, f: number, phaseDeg: number, t: number): number {
  return a * Math.sin(2 * Math.PI * f * t + (phaseDeg * Math.PI) / 180);
}

export function validateSignal(input: SignalInput): Partial<Record<keyof SignalInput, string>> {
  const errors: Partial<Record<keyof SignalInput, string>> = {};
  const units = { a: "V", f: "Hz", phase: "degrees" } as const;
  (Object.keys(SIGNAL_LIMITS) as (keyof SignalInput)[]).forEach((k) => {
    const x = input[k];
    const { min, max } = SIGNAL_LIMITS[k];
    if (typeof x !== "number" || !Number.isFinite(x)) errors[k] = "Enter a number";
    else if (x < min || x > max) errors[k] = `Must be ${min} to ${max} ${units[k]}`;
  });
  return errors;
}

/** 401 evenly spaced samples over 0..1 s (2.5 ms step, 40 samples per cycle at 10 Hz). */
export function sampleSignal(input: SignalInput, n = SIGNAL_SAMPLES): SignalResult {
  const errors = validateSignal(input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const points: SignalPoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i * SIGNAL_DURATION) / (n - 1);
    points.push({ t, v: sinusoid(input.a, input.f, input.phase, t) });
  }
  return { ok: true, points, periodS: 1 / input.f };
}
