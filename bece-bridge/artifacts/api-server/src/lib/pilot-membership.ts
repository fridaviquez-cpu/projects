/** Live configuration, not the seed list, determines eligibility. */
export function withPilotMembership<T extends { id: string }>(
  courses: readonly T[],
  configuration: readonly { courseId: string; isPilot: boolean }[],
) {
  const enabled = new Set(configuration.filter(c => c.isPilot).map(c => c.courseId));
  return courses.map(course => ({ ...course, isPilot: enabled.has(course.id) }));
}
