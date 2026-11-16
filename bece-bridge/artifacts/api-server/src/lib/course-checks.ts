import { randomInt, randomUUID } from "node:crypto";
import { courseScopeContext } from "./course-scope";
import type { CheckedQuestion } from "./bridge-learning";

type Skill = { id: string; concept: string; title: string; content: string };
export function isCorrectAnswer(courseId: string, submitted: number, expected: number) {
  if (!Number.isFinite(submitted)) return false;
  // Discrete bit patterns, integer traces, and array reads must be exact.
  if (courseId === "120" || courseId === "220") return submitted === expected;
  return Math.abs(submitted-expected) <= Math.max(0.015,Math.abs(expected)*0.005);
}

const skills: Record<string, Skill[]> = {
  "110": [
    { id: "110-ohm", concept: "Ohm's law", title: "Relate voltage, resistance, and current", content: "For an ideal positive resistor under DC conditions, V = IR, so I = V/R. With 12 V across 4 kΩ, I = 3 mA. Volts divided by kilohms gives milliamperes; using ohms instead gives amperes. Doubling resistance at fixed voltage halves current." },
    { id: "110-divider", concept: "Voltage division", title: "Find an unloaded divider's output", content: "Two ideal resistors R₁ and R₂ form a series path across Vₛ. Output is measured across R₂ with no load. The common current is Vₛ/(R₁+R₂), so Vout = VₛR₂/(R₁+R₂). For 12 V, R₁ = 2 kΩ and R₂ = 4 kΩ, Vout = 8 V. A load changes the effective lower resistance; this unloaded formula then cannot be used unchanged." },
    { id: "110-power", concept: "Resistor power", title: "Calculate dissipated power", content: "Under the passive sign convention a resistor absorbs P = VI = I²R = V²/R. A 3 V drop across 2 kΩ dissipates 9/2 = 4.5 mW. V²/kΩ yields mW. Power is nonnegative for a positive ideal resistor; this is not the energy in joules." },
  ],
  "120": [
    { id: "120-binary", concept: "Unsigned binary", title: "Read positional binary notation", content: "Each bit has weight 2 raised to its position, starting at zero on the right. Unsigned 101101₂ = 32 + 8 + 4 + 1 = 45. Leading zeros do not change the value. Do not interpret the highest bit as a sign unless a signed representation is specified." },
    { id: "120-signed", concept: "Two's complement", title: "Decode an eight-bit signed value", content: "For an eight-bit two's-complement pattern, first find unsigned value U. If the high bit is 1, signed value = U − 256; otherwise it is U. Thus 11110110₂ represents 246 − 256 = −10. The representable range is −128 through 127. The bit width matters." },
    { id: "120-logic", concept: "Boolean logic", title: "Evaluate a Boolean expression", content: "AND is 1 only when both inputs are 1. OR is 1 when either is 1. NOT flips 0 and 1. Evaluate parentheses first. For A=1, B=0, C=1, (A AND B) OR (NOT C) = 0 OR 0 = 0. Outputs here are single bits, not multi-bit bitwise operations." },
  ],
  "220": [
    { id: "220-loop", concept: "C loop tracing", title: "Trace a bounded C loop", content: "In int sum=0; for(int i=1; i<=n; i++) sum+=i;, the body executes for i=1 through n inclusive. The result is n(n+1)/2. With n=5 the successive sums are 1, 3, 6, 10, 15. These small integer examples cannot overflow. Changing <= to < removes the final iteration. The reference is a mathematical trace, not compiled C execution." },
    { id: "220-array", concept: "C array indexing", title: "Trace an array read", content: "C arrays are zero-indexed: a[0] is the first element. For int a[]={4,7,10,13}; a[2] is 10. For a sequence starting at b with step d, a[k]=b+kd. Only indices 0 through length−1 are valid. Our questions use in-bounds reads; no assumption about undefined behavior is needed." },
    { id: "220-lc3", concept: "LC-3 immediate addition", title: "Trace an LC-3 ADD instruction", content: "ADD R0, R1, #imm5 adds the signed five-bit immediate (−16 through 15) to R1 and writes the result to R0. If R1=12, ADD R0,R1,#-3 gives R0=9. LC-3 registers are 16 bits; these small positive-result examples do not wrap. We ask for the decimal value, not condition codes. This is a reference trace, not an emulator." },
  ],
};

export const extraLessons = Object.entries(skills).flatMap(([courseId, items]) => items.map(s => ({
  ...s, courseId, minutes: 6, sources: courseScopeContext(courseId).sources,
  content: `## Method and worked example\n\n${s.content}\n\n### Self-check\nExplain the assumptions and units, then try fresh numbers in Practice or Recheck.\n\n---\nOriginal BECE Bridge material. Course sources establish topic scope, not instructor review of these derivations. Numeric checks sample three skills only, not the full ECE ${courseId} syllabus.`,
})));

export function courseQuestions(courseId: string, int = randomInt): CheckedQuestion[] {
  const q = (i: number, prompt: string, unit: string, hint: string, expected: number, explanation: string): CheckedQuestion => ({
    id: randomUUID(), concept: skills[courseId]![i]!.concept, lessonId: skills[courseId]![i]!.id,
    prompt, unit, hint, expected, explanation,
  });
  if (courseId === "110") {
    const v=int(4,25), r=int(2,15), top=int(1,12), bottom=int(1,12), pv=int(2,20), pr=int(2,16);
    return [
      q(0, `An ideal resistor of ${r} kΩ has ${v} V across it. Find the DC current in mA.`, "mA", "I = V/R.", v/r, `I = ${v}/${r} = ${v/r} mA; V/kΩ = mA.`),
      q(1, `An unloaded divider has ${v} V across series R₁=${top} kΩ and R₂=${bottom} kΩ. Find the voltage across R₂.`, "V", "Use Vout = Vs R₂/(R₁+R₂).", v*bottom/(top+bottom), `I = ${v}/(${top}+${bottom}) mA. Vout = I × ${bottom} = ${v*bottom/(top+bottom)} V.`),
      q(2, `An ideal ${pr} kΩ resistor has ${pv} V across it. Find its dissipated power in mW.`, "mW", "P = V²/R; V²/kΩ gives mW.", pv*pv/pr, `P = ${pv}²/${pr} = ${pv*pv/pr} mW.`),
    ];
  }
  if (courseId === "120") {
    const u=int(16,256), signed=int(128,256), bits=int(0,8);
    const a=(bits>>2)&1, b=(bits>>1)&1, c=bits&1;
    return [
      q(0, `Convert unsigned binary ${u.toString(2).padStart(8,"0")} to decimal.`, "decimal", "Sum the powers of two where bits are 1.", u, `${u.toString(2)}₂ = ${[...u.toString(2)].reverse().flatMap((b,i)=>b==="1"?[2**i]:[]).reverse().join(" + ")} = ${u}.`),
      q(1, `Interpret ${signed.toString(2)} as an eight-bit two's-complement integer. Give its decimal value.`, "decimal", "The high bit is 1: subtract 256 from the unsigned value.", signed-256, `Unsigned value = ${signed}. Signed value = ${signed} − 256 = ${signed-256}.`),
      q(2, `For A=${a}, B=${b}, C=${c}, evaluate (A AND B) OR (NOT C). Enter 0 or 1.`, "bit", "Evaluate AND and NOT before OR.", (a&b)|(1-c), `A AND B = ${a&b}; NOT C = ${1-c}; OR gives ${(a&b)|(1-c)}.`),
    ];
  }
  if (courseId === "220") {
    const n=int(3,31), base=int(1,20), step=int(2,8), k=int(1,6), reg=int(20,100), imm=int(-16,16);
    const array=Array.from({length:6},(_,i)=>base+i*step);
    return [
      q(0, `Trace C: int sum=0; for(int i=1; i<=${n}; i++) sum+=i; What is sum afterward?`, "integer", "Sum 1 through n inclusive.", n*(n+1)/2, `There are ${n} iterations. sum = ${n}(${n}+1)/2 = ${n*(n+1)/2}. No overflow occurs.`),
      q(1, `Given C array int a[6]={${array.join(",")}}; what value does a[${k}] read?`, "integer", "Indices start at zero.", array[k]!, `Index ${k} selects element ${k+1}: ${base} + ${k}×${step} = ${array[k]}. The index is in bounds.`),
      q(2, `LC-3 R1 contains decimal ${reg}. After ADD R0, R1, #${imm}, what decimal value is in R0?`, "decimal", "Add the signed immediate to R1.", reg+imm, `R0 = ${reg} + (${imm}) = ${reg+imm}. The immediate fits signed imm5 and the result does not wrap 16 bits.`),
    ];
  }
  throw new Error(`No assessed coverage for ECE ${courseId}`);
}
