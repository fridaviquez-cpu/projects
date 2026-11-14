/**
 * Transparent local scoring for the 12-prompt Career DNA reflection.
 * Each dimension is the average of four prompts (1-5 scale), rescaled to 0-100.
 * This is self-reflection, not a clinical, scientific or official assessment.
 */
export const DNA_DIMENSIONS = [
  { name: 'Analytical', description: 'breaking down problems, patterns, evidence, systems', questions: [0, 3, 6, 9] },
  { name: 'Collaborative', description: 'talking it through, inclusion, shared credit, motivation', questions: [1, 4, 7, 10] },
  { name: 'Initiative', description: 'starting, deciding, owning the unclear, pushing forward', questions: [2, 5, 8, 11] },
] as const;

export function validDnaAnswers(a?: number[] | null): a is number[] {
  return Array.isArray(a) && a.length === 12 && a.every((n) => Number.isInteger(n) && n >= 1 && n <= 5);
}

export function scoreDna(a: number[]) {
  return DNA_DIMENSIONS.map((d) => {
    const sum = d.questions.reduce((s, i) => s + a[i], 0);
    return { name: d.name, description: d.description, score: Math.round(((sum - 4) / 16) * 100) };
  });
}

export function describeDna(a: number[]) {
  const s = [...scoreDna(a)].sort((x, y) => y.score - x.score);
  return `Strongest lean: ${s[0].name} (${s[0].score}%). Then ${s[1].name} (${s[1].score}%) and ${s[2].name} (${s[2].score}%).\n\nScoring: each dimension averages four of your answers and rescales them from 0 to 100. Use it as a prompt for how you describe yourself, not as a measurement.`;
}
