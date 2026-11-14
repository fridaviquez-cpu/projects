import type { Preferences, LearningTopic } from '@workspace/api-client-react';
import type { AssistantMode } from '@/lib/ask';

type PreferencesExperience = Preferences['experience'];
type PreferencesHorizon = Preferences['horizon'];
type AssistantInputMode = AssistantMode;
type Lesson = LearningTopic;

/* ------------------------------------------------------------------ */
/* Data access                                                         */
/* ------------------------------------------------------------------ */

export const EMPTY_PREFS: Preferences = {
  status: 'new', experience: null, objectives: [], brokerages: [], accountTypes: [], goals: [], horizon: null, learning: [],
};

/** True when the user has answered at least one question. */
export const hasAnswers = (p: Preferences | null) =>
  !!p && (p.experience !== null || p.horizon !== null || p.objectives.length + p.brokerages.length + p.accountTypes.length + p.goals.length + p.learning.length > 0);

/* ------------------------------------------------------------------ */
/* Questions                                                           */
/* ------------------------------------------------------------------ */

export type Opt = { value: string; label: string; hint?: string };
export type Question = {
  key: 'experience' | 'objectives' | 'brokerages' | 'accountTypes' | 'goals' | 'horizon' | 'learning';
  title: string; help: string; multi: boolean; options: Opt[];
};

export const QUESTIONS: Question[] = [
  {
    key: 'experience', multi: false, title: 'How much have you invested before?',
    help: 'Sets how much we explain at first. You can change it any time; it is not a label.',
    options: [
      { value: 'new', label: 'I am completely new' },
      { value: 'basics', label: 'I understand the basics' },
      { value: 'regular', label: 'I invest regularly' },
      { value: 'experienced', label: 'I am experienced' },
    ],
  },
  {
    key: 'objectives', multi: true, title: 'What brings you here?',
    help: 'Pick any. This decides what your overview puts first.',
    options: [
      { value: 'understand', label: 'Understand what I already own' },
      { value: 'learn', label: 'Learn how investing works' },
      { value: 'wealth', label: 'Build long-term wealth' },
      { value: 'diversification', label: 'Check my diversification' },
      { value: 'decisions', label: 'Track my investment decisions' },
      { value: 'retirement', label: 'Plan for retirement' },
      { value: 'home-business', label: 'Save for a home or business' },
      { value: 'practice', label: 'Practice investing ideas' },
    ],
  },
  {
    key: 'brokerages', multi: true, title: 'Where do you invest today?',
    help: 'Only used to explain the terms each platform shows. PortfolioIQ never connects to or reads your brokerage account.',
    options: [
      { value: 'Fidelity', label: 'Fidelity' },
      { value: 'Vanguard', label: 'Vanguard' },
      { value: 'Robinhood', label: 'Robinhood' },
      { value: 'Charles Schwab', label: 'Charles Schwab' },
      { value: 'Other', label: 'Another institution' },
      { value: 'None', label: 'Not investing yet' },
    ],
  },
  {
    key: 'accountTypes', multi: true, title: 'Which kinds of accounts do you have?',
    help: 'Not sure what these mean? Each one has a short note.',
    options: [
      { value: 'Roth IRA', label: 'Roth IRA', hint: 'Retirement account funded with after-tax money; qualified withdrawals later are generally tax-free.' },
      { value: 'Traditional IRA', label: 'Traditional IRA', hint: 'Retirement account where contributions may be tax-deductible; withdrawals are generally taxed.' },
      { value: 'Brokerage', label: 'Individual brokerage', hint: 'A regular taxable account with no special retirement rules.' },
      { value: '401(k)', label: '401(k)', hint: 'Employer-sponsored retirement plan, often with a limited fund menu.' },
      { value: 'Savings', label: 'Savings account', hint: 'Bank deposits, not invested in markets.' },
      { value: 'Not sure', label: 'Not sure' },
    ],
  },
  {
    key: 'goals', multi: true, title: 'What are you working toward?',
    help: 'Used to frame the wealth sketch and journal prompts. It never changes the math.',
    options: [
      { value: 'Retirement', label: 'Retirement' },
      { value: 'Homeownership', label: 'Buying a home' },
      { value: 'Business', label: 'Starting a business' },
      { value: 'Financial independence', label: 'Financial independence' },
      { value: 'Learning', label: 'Mostly learning' },
    ],
  },
  {
    key: 'horizon', multi: false, title: 'When might you need this money?',
    help: 'Optional. Money needed soon usually calls for a different conversation than money needed in decades.',
    options: [
      { value: 'under-3', label: 'Less than 3 years' },
      { value: '3-5', label: '3 to 5 years' },
      { value: '5-10', label: '5 to 10 years' },
      { value: 'over-10', label: 'More than 10 years' },
      { value: 'unsure', label: 'I am not sure' },
    ],
  },
  {
    key: 'learning', multi: true, title: 'How do you like to learn?',
    help: 'Shapes how lessons and explanations are presented.',
    options: [
      { value: 'simple', label: 'Simple explanations' },
      { value: 'detailed', label: 'Detailed explanations' },
      { value: 'interactive', label: 'Interactive examples' },
      { value: 'visual', label: 'Visual diagrams' },
      { value: 'quizzes', label: 'Quizzes and practice' },
    ],
  },
];

export function labelFor(key: Question['key'], value: string | null): string {
  if (value === null) return '';
  return QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.value === value)?.label ?? value;
}

export function getAnswer(p: Preferences, key: Question['key']): string[] {
  const v = p[key];
  if (Array.isArray(v)) return v as string[];
  return v === null ? [] : [v as string];
}

export function setAnswer(p: Preferences, key: Question['key'], values: string[]): Preferences {
  if (key === 'experience') return { ...p, experience: (values[0] ?? null) as PreferencesExperience };
  if (key === 'horizon') return { ...p, horizon: (values[0] ?? null) as PreferencesHorizon };
  return { ...p, [key]: values } as Preferences;
}

/** Short chips describing what personalization is active. */
export function prefChips(p: Preferences | null): string[] {
  if (!p) return [];
  const out: string[] = [];
  if (p.experience) out.push(labelFor('experience', p.experience));
  p.goals.slice(0, 2).forEach((g) => { out.push(labelFor('goals', g)); });
  if (p.horizon) out.push(`Horizon: ${labelFor('horizon', p.horizon).toLowerCase()}`);
  p.brokerages.filter((b) => b !== 'None' && b !== 'Other').slice(0, 2).forEach((b) => { out.push(b); });
  return out;
}

/* ------------------------------------------------------------------ */
/* Dashboard priorities                                                */
/* ------------------------------------------------------------------ */

export type Section = 'allocation' | 'insights' | 'learn' | 'thesis' | 'wealth';
export type NextAction = { id: string; title: string; body: string; href: string; cta: string };

export function dashboardPlan(p: Preferences | null): { order: Section[]; actions: NextAction[]; focus: string } {
  const score: Record<Section, number> = { allocation: 5, insights: 4, thesis: 2, learn: 2, wealth: 1 };
  const o = new Set(p?.objectives ?? []);
  if (o.has('understand')) { score.allocation += 3; score.insights += 2; }
  if (o.has('diversification')) { score.insights += 4; score.allocation += 2; }
  if (o.has('learn') || o.has('practice')) score.learn += 5;
  if (p?.experience === 'new' || p?.experience === 'basics') score.learn += 3;
  if (o.has('decisions')) score.thesis += 5;
  if (o.has('wealth') || o.has('retirement') || o.has('home-business')) score.wealth += 5;
  if ((p?.goals ?? []).length) score.wealth += 1;
  const order = (Object.keys(score) as Section[]).sort((a, b) => score[b] - score[a]);

  const A: Record<Section, NextAction> = {
    allocation: { id: 'allocation', title: 'See where your money sits', body: 'Review the split across stocks, funds, bonds and cash.', href: '/portfolio', cta: 'Open holdings' },
    insights: { id: 'insights', title: 'Check concentration', body: 'Look for single positions that carry a large share of the total.', href: '/portfolio', cta: 'Review holdings' },
    learn: { id: 'learn', title: p?.experience === 'new' ? 'Start with the first lesson' : 'Pick up a lesson', body: 'Short reads matched to your answers, each ending in one question.', href: '/learn', cta: 'Go to Learn' },
    thesis: { id: 'thesis', title: 'Write down one reason', body: 'Note why you own something before the memory fades.', href: '/thesis', cta: 'Open journal' },
    wealth: { id: 'wealth', title: 'Sketch your time horizon', body: 'See how contributions and time interact. Illustration only.', href: '/wealth', cta: 'Open sketch' },
  };
  const focus = order[0] === 'learn' ? 'learning first' : order[0] === 'thesis' ? 'decisions first' : order[0] === 'wealth' ? 'long-term goals first' : order[0] === 'insights' ? 'diversification first' : 'your holdings first';
  return { order, actions: order.slice(0, 3).map((s) => A[s]), focus };
}

/* ------------------------------------------------------------------ */
/* Learn                                                               */
/* ------------------------------------------------------------------ */

export type LearnStyle = { depth: 'simple' | 'detailed' | 'standard'; quizFirst: boolean; visual: boolean; interactive: boolean; label: string };

export function learnStyle(p: Preferences | null): LearnStyle {
  const l = new Set(p?.learning ?? []);
  const exp = p?.experience;
  const depth = l.has('detailed') || exp === 'experienced' ? 'detailed' : l.has('simple') || exp === 'new' ? 'simple' : 'standard';
  const parts = [depth === 'simple' ? 'Plain-language summaries' : depth === 'detailed' ? 'Full detail' : 'Balanced detail'];
  if (l.has('quizzes')) parts.push('questions up front');
  if (l.has('visual')) parts.push('visual key points');
  if (l.has('interactive')) parts.push('try-it prompts');
  return { depth, quizFirst: l.has('quizzes'), visual: l.has('visual'), interactive: l.has('interactive'), label: parts.join(', ') };
}

const TOPIC_WORDS: Record<string, string[]> = {
  understand: ['fund', 'etf', 'stock', 'bond', 'cash', 'basics', 'what'],
  learn: ['basics', 'what', 'how', 'compound'],
  wealth: ['compound', 'long', 'time', 'growth'],
  diversification: ['divers', 'concentrat', 'allocation', 'risk', 'overlap'],
  decisions: ['thesis', 'decision', 'bias', 'behav'],
  retirement: ['retire', 'ira', '401', 'roth', 'tax'],
  'home-business': ['goal', 'short', 'cash', 'emergency', 'risk'],
  practice: ['risk', 'diversif', 'compound'],
};

/** Rank lessons for this user and attach a reason; incomplete before complete. */
export function rankLessons(lessons: Lesson[], p: Preferences | null): { lesson: Lesson; score: number; reason: string | null }[] {
  const objectives = p?.objectives ?? [];
  const accountWords = (p?.accountTypes ?? []).some((a) => a.includes('IRA') || a === '401(k)') ? ['ira', 'roth', '401', 'retire'] : [];
  return lessons.map((lesson, i) => {
    const hay = `${lesson.title} ${lesson.track}`.toLowerCase();
    let score = 0; let reason: string | null = null;
    for (const o of objectives) {
      if ((TOPIC_WORDS[o] ?? []).some((w) => hay.includes(w))) { score += 3; reason ??= `Matches: ${labelFor('objectives', o).toLowerCase()}`; }
    }
    if (accountWords.some((w) => hay.includes(w))) { score += 2; reason ??= 'Relates to your account types'; }
    if ((p?.experience === 'new' || p?.experience === 'basics') && lesson.minutes <= 4) { score += 1; reason ??= 'A short starting point'; }
    if (lesson.completed) score -= 10;
    return { lesson, score: score - i * 0.01, reason: p ? reason : null };
  });
}

/** Split lesson text into display paragraphs per style. Simple keeps the opening paragraphs and folds the rest. */
export function shapeContent(content: string, style: LearnStyle): { lead: string[]; more: string[] } {
  const paras = content.split(/\n{2,}/).filter((x) => x.trim());
  if (style.depth !== 'simple' || paras.length <= 2) return { lead: paras, more: [] };
  return { lead: paras.slice(0, 2), more: paras.slice(2) };
}

/* ------------------------------------------------------------------ */
/* Thesis                                                              */
/* ------------------------------------------------------------------ */

export function thesisPrompts(p: Preferences | null): { title: string; reasoning: string }[] {
  const out: { title: string; reasoning: string }[] = [];
  const g = new Set(p?.goals ?? []);
  const exp = p?.experience;
  if (g.has('Retirement') || (p?.objectives ?? []).includes('retirement')) out.push({ title: 'Why this belongs in my retirement money', reasoning: 'How long until I expect to use this? What would make me change it before then?' });
  if (g.has('Homeownership') || g.has('Business') || p?.horizon === 'under-3' || p?.horizon === '3-5') out.push({ title: 'Is this right for money I need soon?', reasoning: 'If this fell 20% the year I need the money, what would I do?' });
  if ((p?.objectives ?? []).includes('diversification')) out.push({ title: 'What this adds that I do not already own', reasoning: 'Which of my other holdings already cover the same companies or sectors?' });
  if (exp === 'new' || exp === 'basics') out.push({ title: 'What I understand about this fund', reasoning: 'In one sentence, what does it hold? What do I still not understand?' });
  if (exp === 'regular' || exp === 'experienced') out.push({ title: 'What would make me sell', reasoning: 'Write the specific condition, not a feeling. When will I check it?' });
  if (g.has('Financial independence')) out.push({ title: 'How this supports independence', reasoning: 'Does this produce income, growth, or stability for my plan?' });
  if (!out.length) out.push({ title: 'Why I own this', reasoning: 'What do I believe, and what would have to be true?' });
  return out.slice(0, 4);
}

/* ------------------------------------------------------------------ */
/* Wealth                                                              */
/* ------------------------------------------------------------------ */

const HORIZON_YEARS: Record<string, number | null> = { 'under-3': 3, '3-5': 5, '5-10': 10, 'over-10': 25, unsure: null };

/** Prefill only the time span from horizon. The return assumption is never derived from preferences. */
export function wealthPrefill(p: Preferences | null): { years: number | null; goalLabel: string | null; shortHorizon: boolean } {
  const years = p?.horizon ? HORIZON_YEARS[p.horizon] ?? null : null;
  const goal = p?.goals[0] ?? null;
  return { years, goalLabel: goal ? labelFor('goals', goal) : null, shortHorizon: p?.horizon === 'under-3' || p?.horizon === '3-5' };
}

/* ------------------------------------------------------------------ */
/* Assistant                                                           */
/* ------------------------------------------------------------------ */

const BASE_PROMPTS: Record<AssistantInputMode, string[]> = {
  Portfolio: ['What is my largest concentration?', 'Explain my cash position in plain words'],
  Learn: ['What is the difference between an ETF and a mutual fund?', 'Why does diversification matter?'],
  Thesis: ['What risks am I possibly overlooking?', 'How should I know when to revisit a thesis?'],
  Wealth: ['How sensitive is compounding to the rate?', 'Why do early contributions matter so much?'],
};

export function assistantPrompts(mode: AssistantInputMode, p: Preferences | null): string[] {
  const extra: string[] = [];
  const b = (p?.brokerages ?? []).find((x) => x !== 'None' && x !== 'Other');
  if (mode === 'Portfolio' && b) extra.push(`What do the cash lines on my ${b} statement mean?`);
  if (mode === 'Learn' && p?.experience === 'new') extra.push('Explain index funds like I am starting from zero');
  if (mode === 'Learn' && (p?.accountTypes ?? []).includes('Roth IRA')) extra.push('How is a Roth IRA different from a brokerage account?');
  if (mode === 'Thesis' && p?.goals.length) extra.push(`How do I write a thesis tied to ${labelFor('goals', p.goals[0]).toLowerCase()}?`);
  if (mode === 'Wealth' && p?.horizon && p.horizon !== 'unsure') extra.push(`What changes when my horizon is ${labelFor('horizon', p.horizon).toLowerCase()}?`);
  return [...extra, ...BASE_PROMPTS[mode]].slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* Brokerage glossary (educational only)                               */
/* ------------------------------------------------------------------ */

export type GlossaryEntry = { term: string; meaning: string };
export const BROKERAGE_GLOSSARY: Record<string, GlossaryEntry[]> = {
  Fidelity: [
    { term: 'SPAXX (core position)', meaning: 'Fidelity often holds uninvested cash in a money market fund such as SPAXX. Treat it as cash-like, not a stock pick.' },
    { term: 'Cost basis', meaning: 'Total amount paid for a position. Fidelity may show it on a separate tab; screenshots of the positions list often omit it.' },
    { term: 'Pending activity', meaning: 'Trades or transfers not yet settled. They can make the account total differ from the sum of positions.' },
  ],
  Vanguard: [
    { term: 'Settlement fund (VMFXX)', meaning: 'A money market fund used as the cash sweep. It is cash-like and pays a variable yield.' },
    { term: 'Admiral shares', meaning: 'A share class of Vanguard mutual funds, usually with lower expense ratios than Investor shares.' },
  ],
  Robinhood: [
    { term: 'Buying power', meaning: 'Cash available to trade, possibly including margin. It is not the same as the value of your holdings.' },
    { term: 'Fractional shares', meaning: 'Quantities like 0.37 shares are normal; PortfolioIQ keeps the exact decimal.' },
  ],
  'Charles Schwab': [
    { term: 'Cash and cash investments', meaning: 'Schwab groups swept cash and money market funds together. Avoid counting the same cash twice.' },
    { term: 'Day change', meaning: 'Movement since the previous close. PortfolioIQ does not track daily changes or live prices.' },
  ],
  Other: [
    { term: 'Market value', meaning: 'Quantity times the most recent price the platform used. It is a snapshot, not a guarantee.' },
    { term: 'Unrealized gain', meaning: 'Difference between market value and cost basis for positions you still hold. Needs cost basis to compute.' },
  ],
};

export function glossaryFor(p: Preferences | null): { brokerage: string; entries: GlossaryEntry[] }[] {
  const list = (p?.brokerages ?? []).filter((b) => b !== 'None');
  return (list.length ? list : ['Other']).map((b) => ({ brokerage: b === 'Other' ? 'Any platform' : b, entries: BROKERAGE_GLOSSARY[b] ?? BROKERAGE_GLOSSARY.Other }));
}

