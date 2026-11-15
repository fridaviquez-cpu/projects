import { KINDS, type Workspace } from '../lib/career-client';

export const DRAFT_KEY = 'orvyn:resume-drafts:v1';

/** All supported kinds and optional fields, including Unicode and multiline text. */
export function workspace(): Workspace {
  return {
    version: 1,
    savedAt: '2026-01-02T12:00:00.000Z',
    profile: { name: 'Guest É' },
    records: KINDS.map((kind, i) => ({
      id: `record-${i}`, kind, title: `${kind} — café`,
      company: 'Example', category: 'Projects', status: 'active',
      description: 'Description\nsecond line', notes: 'Review carefully',
      deadline: '2027-02-03', interviewAt: '2027-02-01T12:00:00.000Z',
      location: 'Remote', salary: '100–120', contact: 'Hiring team',
      url: 'https://example.com/jobs/1', skills: 'Writing, TypeScript',
      results: 'Improved delivery', startDate: '2025-01-01', endDate: '2026-01-01',
      content: i === 2 ? '' : 'Résumé\n• Achieved a result\n你好',
      opportunityId: 'record-0', officialStrengths: 'Learning',
      answers: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2],
      createdAt: '2026-01-01T12:00:00.000Z',
      updatedAt: '2026-01-02T12:00:00.000Z',
    })),
  };
}
