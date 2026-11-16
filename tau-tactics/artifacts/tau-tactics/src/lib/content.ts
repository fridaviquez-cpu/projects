import { breakFor } from "./timer-core";

export const TAU_SITE = "https://tau-tactics.netlify.app/";
export const TOOLKIT_DRIVE = "https://drive.google.com/file/d/1GaBx365QovgbwOqqF93kwFSn23YGT5yo/view";

export const scienceCards = [
  { title: "Fast rewards rewire expectations.", body: "Every scroll delivers a quick reward. Over time your brain can come to expect instant payoff, and studying can't compete on speed." },
  { title: "Constant stimulation strains attention.", body: "The more you task-switch, the harder sustained attention tends to become. In one study, heavy media multitaskers performed worse at switching, not better." },
  { title: "Task switching leaves residue.", body: "Part of your attention can stay stuck on the last thing you checked. One \"quick look\" at your phone may tax the next stretch of work." },
  { title: "Focus is trainable.", body: "Like a muscle, sustained attention appears to grow with structured reps. That's the entire premise of TAU Tactics." },
];

export const loop = [
  { step: "Slow task", note: "Studying feels effortful" },
  { step: "Quick escape", note: "Grab the phone" },
  { step: "Fast reward", note: "A quick hit of novelty" },
  { step: "Craving", note: "Brain wants more" },
  { step: "Break it here", note: "Phone out of reach + timer on", cut: true },
];

export const stats = [
  { n: "23", unit: "min", label: "commonly cited time to refocus after an interruption" },
  { n: "47", unit: "%", label: "of waking hours spent mind-wandering in one large sample study" },
  { n: "4", unit: "tools", label: "AI tools, used the right way" },
];

export const tactics = [
  { id: "warmup", name: "The 2-Minute Focus Warm-Up", tag: "Beat resistance", how: "Commit to just 2 minutes of the task. Set a timer, open the material, begin. When the timer ends, you choose: stop or continue. You'll almost always continue.", why: "Starting is the expensive part. The Zeigarnik effect suggests an opened task keeps pulling at your attention until it's done. Shrinking the entry cost to 2 minutes removes the resistance that keeps you on the couch." },
  { id: "pomodoro", name: "The Pomodoro Method", tag: "Structured sessions", how: "Work in fixed blocks (the TAU standard: 30 min focus / 7 min break). During the block, one task only. During the break, get away from the screen. After 2-4 blocks, take a longer break.", why: "Deadlines create urgency, and known break points make it easier to defer distractions; 'I'll check it at the break' works when the break is minutes away. Brief breaks may also counter vigilance decrement, the natural decay of sustained attention." },
  { id: "timed", name: "Timed Focus Sessions", tag: "Train the muscle", how: "Track your honest max focus time this week. Next week, add 5 minutes. Progressive overload, but for attention. Log it somewhere you'll see.", why: "Attention behaves like a trainable capacity: noticing you've drifted and returning to the task is the rep. What gets measured gets trained." },
  { id: "timelapse", name: "The Timelapse Method", tag: "Accountability", how: "Prop up your phone, start a timelapse recording of yourself studying, and work. You can't pick up the phone; it's the camera now.", why: "Two mechanisms: your phone is physically repurposed (removing the temptation), and being observed, even by your own camera, can trigger accountability effects that reduce off-task behavior." },
  { id: "doodle", name: "Doodling During Breaks", tag: "Mental reset", how: "During your 7-minute break, doodle on paper. Nothing productive, nothing on a screen. Shapes, sketches, whatever.", why: "Breaks restore attention best when they don't hijack the same reward circuits you're trying to calm. Doodling keeps arousal low; one study (Andrade, 2010) found doodlers recalled 29% more information on a monitoring task." },
  { id: "source", name: "Reduce Distractions at the Source", tag: "Environment design", how: "Phone on Do Not Disturb, on a different surface, screen down. Close every tab that isn't the task. One input, one output.", why: "In one set of experiments, the mere presence of participants' own phones was associated with lower available working memory, even face-down and silent (Ward et al., 2017). Willpower is a losing strategy; distance is a winning one." },
];

export const myths = [
  { myth: "I study better under pressure.", fact: "You don't, you just finally study. Pressure removes the option to procrastinate; it doesn't improve encoding. Cramming can work for tomorrow's quiz and fail for the final: spaced study reliably beats massed study for retention in the research.", source: "Cepeda et al. (2006), meta-analysis of 254 studies on spacing" },
  { myth: "Multitasking helps me get more done.", fact: "Heavy media multitaskers performed worse on task-switching tests than light ones. Every switch can leave 'attention residue': part of your mind stays on the last task. You're not doing two things; you're doing both less well.", source: "Ophir, Nass & Wagner (2009); Leroy (2009)" },
  { myth: "Longer study sessions are better.", fact: "Past a point, more hours tends to mean more mind-wandering, not more learning. Distributed practice, same total time spread out, produces stronger long-term retention than marathon sessions.", source: "Dunlosky et al. (2013), Psychological Science in the Public Interest" },
  { myth: "My phone face-down doesn't affect me.", fact: "The mere presence of your own smartphone was linked to reduced available working memory capacity, even when silent and face-down. Best performance came when the phone was in another room.", source: "Ward, Duke, Gneezy & Bos (2017), 'Brain Drain'" },
  { myth: "Re-reading my notes is studying.", fact: "Re-reading feels productive because it's fluent: you recognize everything. But recognition isn't recall. Testing yourself outperformed repeated re-reading for long-term retention.", source: "Karpicke & Roediger (2008), Science" },
  { myth: "AI can just do the thinking for me.", fact: "Learning happens in the struggle: retrieval, error, correction. Offload the struggle and you offload the learning. Use AI to generate practice problems, check reasoning, and explain gaps: amplifier, not autopilot.", source: "Consistent with retrieval-practice literature (Roediger & Butler, 2011)" },
];

export const SOLVE_PROMPT = `Solve and explain this problem.

Before solving, adjust based on:
- Depth: [very detailed / standard / quick]
- Purpose: [learn / practice / check answer]

PROCESS:
1. Understand: restate the question,
   identify knowns and unknowns
2. Plan: choose a method, explain why
3. Solve: show steps, clear and logical
4. Final Answer: labeled, with units

If VERY DETAILED -> no skipped steps, full teaching
If STANDARD -> key steps only
If QUICK -> minimal explanation

Optional: shortcut method + common mistakes`;

export const TUTOR_PROMPT = `You are an expert tutor. My goal is [learn it from scratch / prepare for an exam / fix one specific gap] and my current level is [beginner / some exposure / comfortable].

Topic: [paste topic or problem]

Teach me in short steps. After each step, ask me one question and wait for my answer before continuing. If I'm wrong, show me where my reasoning broke instead of giving the answer. End with three practice questions I should be able to answer on my own.`;

export const VISUAL_PROMPT = `Create clean, visual notes based on what you can see in my handwritten notes. [attach photo of your notes]

Organize by topic, highlight key formulas and definitions, and flag anything you can't read so I can fill it in myself.`;

export const aiTools = [
  {
    id: "perplexity", name: "Perplexity", best: "Research & sources", url: "https://www.perplexity.ai/",
    tags: ["Credible sources", "Citations", "Finding textbooks", "Current info"],
    tasks: ["find", "research"],
    label: "Real prompt",
    prompt: "find me this book: marketing of high\ntechnology products and innovations\nchapter 5 third edition",
    note: "Actual result in the chapter's demo: the exact edition identified, with legal access routes (publisher page, VitalSource, the UIUC library catalog), each with citations. Always open the citations yourself.",
  },
  {
    id: "chatgpt", name: "ChatGPT / Gemini", best: "Problem-solving & explanation", url: "https://chatgpt.com/", url2: "https://gemini.google.com/",
    tags: ["Difficult concepts", "Engineering & math", "Step-by-step thinking", "Brainstorming", "Thinking partner"],
    tasks: ["solve", "explain"],
    label: "Study Guide Prompt, from the Prompt Library",
    prompt: SOLVE_PROMPT,
    note: "Don't ask for answers, ask for teaching. This prompt forces the AI to show its process at the depth you choose.",
  },
  {
    id: "claude", name: "Claude", best: "Study guides & visual learning", url: "https://claude.ai/",
    tags: ["Study guides", "Organizing notes", "Visual learning", "Long-form explanations"],
    tasks: ["organize", "explain"],
    label: "Real prompt",
    prompt: "Create clean, visual notes based on\nwhat you can see in my handwritten\nnotes. [photo of ECE 330 notes]",
    note: "Actual result in the chapter's demo: messy handwritten ECE 330 notes turned into a color-coded visual study guide of Fourier transform properties, with formulas highlighted.",
  },
  {
    id: "notebooklm", name: "NotebookLM", best: "Your personal professor", url: "https://notebooklm.google.com/",
    tags: ["Upload class material", "Interactive Q&A", "Audio overviews", "Mind maps", "Grounded in YOUR sources"],
    tasks: ["review", "organize"],
    label: "Real workflow",
    prompt: "1. Upload every lecture PDF + your notes\n2. Ask questions, answers cite YOUR slides\n3. Generate a syllabus mind map\n4. Audio overview -> listen walking to class",
    note: "Actual notebook in the demo: 11 ECE 330 sources loaded, chat cites the exact slide, and Studio generates quizzes, flashcards, reports, and a course mind map from Power Circuit Analysis to System Stability.",
  },
];

export const aiTasks = [
  { id: "find", label: "Find a source or textbook" },
  { id: "research", label: "Research a current topic" },
  { id: "solve", label: "Work through a hard problem" },
  { id: "explain", label: "Understand a concept" },
  { id: "organize", label: "Turn notes into a study guide" },
  { id: "review", label: "Review my own course material" },
];

export const wrongWays = [
  { t: "Copying answers", b: "without understanding. You saved 20 minutes and lost the exam." },
  { t: "Relying on AI instead of learning.", b: "If the tool disappears and your knowledge goes with it, it was never yours." },
  { t: "Skipping the thinking process.", b: "The struggle IS the learning. AI should scaffold it, not delete it." },
  { t: "Using AI as a shortcut", b: "instead of an amplifier. Shortcuts compound into gaps; amplifiers compound into mastery." },
];

export type Resource = { id: string; cat: "AI Tools" | "Apps & Extensions" | "Videos & Channels" | "Books" | "Prompt Library"; kind: string; name: string; desc: string; url?: string; prompt?: string };

export const resources: Resource[] = [
  { id: "perplexity", cat: "AI Tools", kind: "AI Tool", name: "Perplexity", desc: "Research with citations. Finding sources, textbooks, current information.", url: "https://www.perplexity.ai/" },
  { id: "chatgpt", cat: "AI Tools", kind: "AI Tool", name: "ChatGPT", desc: "Step-by-step problem solving, concept explanation, brainstorming partner.", url: "https://chatgpt.com/" },
  { id: "gemini", cat: "AI Tools", kind: "AI Tool", name: "Gemini", desc: "Strong at math/engineering reasoning; integrates with Google Workspace.", url: "https://gemini.google.com/" },
  { id: "claude", cat: "AI Tools", kind: "AI Tool", name: "Claude", desc: "Study guides, organizing notes, visual learning, long-form explanation.", url: "https://claude.ai/" },
  { id: "notebooklm", cat: "AI Tools", kind: "AI Tool", name: "NotebookLM", desc: "Upload class material for a personal professor. Q&A, mind maps, audio overviews.", url: "https://notebooklm.google.com/" },
  { id: "pomodoro-jb", cat: "Apps & Extensions", kind: "Web App", name: "Pomodoro Timer (Jorge Becerra)", desc: "Clean Pomodoro web app to structure focus sessions. Built by a fellow student.", url: "https://pomodoro-six-omega.vercel.app/" },
  { id: "forest", cat: "Apps & Extensions", kind: "App", name: "Forest", desc: "Plant a tree that dies if you touch your phone. Gamified focus.", url: "https://www.forestapp.cc/" },
  { id: "ublock", cat: "Apps & Extensions", kind: "Extension", name: "uBlock Origin", desc: "Kill ads and autoplay; remove the casino from your browser.", url: "https://ublockorigin.com/" },
  { id: "unhook", cat: "Apps & Extensions", kind: "Extension", name: "Unhook (YouTube)", desc: "Hides the YouTube feed and sidebar. Search-only YouTube = tool, not trap.", url: "https://unhook.app/" },
  { id: "icanstudy", cat: "Videos & Channels", kind: "YouTube", name: "iCanStudy, Justin Sung", desc: "Evidence-based study strategy, memory systems, learning efficiency.", url: "https://www.youtube.com/@icanstudystudent" },
  { id: "3hr", cat: "Videos & Channels", kind: "Video", name: "3-Hour Pomodoro Focus Session", desc: "'Study with me' session (50-10 intervals) with focus-optimized music.", url: "https://youtu.be/74cOUSKXMz0" },
  { id: "penrose", cat: "Videos & Channels", kind: "YouTube", name: "Penrose, G. Penrose", desc: "Thinking skills, cognitive frameworks, and mental models for faster learning.", url: "https://www.youtube.com/@GPenrose" },
  { id: "deepwork", cat: "Books", kind: "Book", name: "Deep Work, Cal Newport", desc: "The case for focused work as the superpower of the 21st century.", url: "https://calnewport.com/writing/" },
  { id: "atomic", cat: "Books", kind: "Book", name: "Atomic Habits, James Clear", desc: "Systems over goals. Environment design over willpower.", url: "https://jamesclear.com/atomic-habits" },
  { id: "makeitstick", cat: "Books", kind: "Book", name: "Make It Stick, Brown et al.", desc: "The science of successful learning: retrieval, spacing, interleaving.", url: "https://www.hup.harvard.edu/books/9780674729018" },
  { id: "p-tutor", cat: "Prompt Library", kind: "Prompt", name: "Deep Learning Tutor", desc: "'You are an expert tutor...' adapts to your goal and level.", prompt: TUTOR_PROMPT },
  { id: "p-solve", cat: "Prompt Library", kind: "Prompt", name: "Solve & Explain", desc: "Understand, Plan, Solve, Final Answer, at the depth you pick.", prompt: SOLVE_PROMPT },
  { id: "p-visual", cat: "Prompt Library", kind: "Prompt", name: "Visual Notes", desc: "Turn handwritten notes into a clean visual study guide.", prompt: VISUAL_PROMPT },
];

export const durations = [
  { v: 25, l: "starting out" },
  { v: 30, l: "TAU standard" },
  { v: 50, l: "trained" },
  { v: 90, l: "deep work" },
];
export const planAI = ["No AI this session", "Perplexity", "ChatGPT / Gemini", "Claude", "NotebookLM"];
export const planMethods = ["2-minute warm-up", "Pomodoro blocks", "Timelapse accountability", "Study with a brother"];
export const planBreaks = ["Doodle", "Walk", "Stretch & breathe", "Hydrate & snack"];

const aiUse: Record<string, string> = {
  "No AI this session": "Try the task from memory first, then check your reasoning against course notes or a textbook. Mark questions to ask your instructor or study partner.",
  Perplexity: "Use Perplexity only to locate sources and readings before the first block. Open every citation it gives you.",
  "ChatGPT / Gemini": "When you get stuck, paste the Solve & Explain prompt with Purpose set to 'learn'. Attempt the problem first.",
  Claude: "At the end, photograph your notes and ask Claude for a visual study guide. Fill in anything it misread.",
  NotebookLM: "Load your lecture slides into NotebookLM. Quiz yourself from it during the last block; answers should cite your slides.",
};
export const methodUse: Record<string, string> = {
  "2-minute warm-up": "Open the material and commit to just 2 minutes. When the 2 minutes end, decide to continue (you probably will).",
  "Pomodoro blocks": "One task per block. Anything that pops up goes on a scrap list for the break.",
  "Timelapse accountability": "Prop your phone up and start a timelapse. It's the camera now, not a feed.",
  "Study with a brother": "Tell a study partner your one task out loud before you start; compare progress at each break.",
};
const breakUse: Record<string, string> = {
  Doodle: "Doodle on paper. No screens.",
  Walk: "Walk a hallway or a lap outside. Leave the phone on the desk.",
  "Stretch & breathe": "Stand, stretch, and take slow breaths for a minute.",
  "Hydrate & snack": "Refill water and eat something small. Not at your desk.",
};

export function protocol(p: { duration: number; breakMinutes?: number; ai: string; method: string; breakStyle: string; notes?: string; task?: string }) {
  const lines = [
    `TAU TACTICS STUDY PLAN`,
    `Focus ${p.duration} min / Break ${p.breakMinutes ?? breakFor(p.duration)} min / Start next focus block when ready / Focus ${p.duration} min / Break ${p.breakMinutes ?? breakFor(p.duration)} min`,
    ``,
    `BEFORE YOU START`,
    `- Phone on Do Not Disturb, on a different surface, screen down.`,
    `- Close every tab that isn't the task.`,
    p.task?.trim() ? `- Task: ${p.task.trim()}` : `- Write your one task down before you press start.`,
    ``,
    `FOCUS (${p.method})`,
    `- ${methodUse[p.method]}`,
    ``,
    p.ai === "No AI this session" ? "INDEPENDENT STUDY (No AI this session)" : `AI (${p.ai})`,
    `- ${aiUse[p.ai]}`,
    ...(p.ai === "No AI this session" ? [] : [`- AI enhances your thinking; it doesn't replace it.`]),
    ``,
    `BREAKS (${p.breakStyle})`,
    `- ${breakUse[p.breakStyle]}`,
    `- Break = reset, not scroll.`,
    ``,
    `AFTER`,
    `- Log your honest focus time. Next week, try adding 5 minutes.`,
  ];
  if (p.notes?.trim()) lines.push("", "MY NOTES", p.notes.trim());
  return lines.join("\n");
}

export const quiz = [
  { q: "It's 9 PM and the assignment is due Friday. What actually happens?", a: ["I'll start Thursday night. It's tradition.", "I start... while also texting, snacking, and checking three apps.", "I grind for 4 hours straight until my brain melts.", "I block 30 minutes tonight and schedule the rest."] },
  { q: "Where is your phone right now (be honest)?", a: ["In my hand. I'm reading this on it.", "Next to me, face up, notifications on.", "Face down but within reach.", "Different room / Do Not Disturb."] },
  { q: "How do you usually review for exams?", a: ["Re-read my notes and highlight. Again.", "All-nighter with energy drinks. Every time.", "A little of everything, nothing consistent.", "Practice problems and self-testing on a schedule."] },
  { q: "Mid-study session, a notification buzzes. You…", a: ["Already answered it. We're in the group chat now.", "Check it 'real quick', 25 minutes vanish.", "Ignore it but think about it the rest of the session.", "Don't hear it. DND until the break."] },
  { q: "Your longest real focused stretch this week was…", a: ["10 minutes, maybe. Between checks.", "One panicked 3-hour marathon.", "Depends entirely on the deadline.", "Consistent 25–50 min blocks most days."] },
];

export const quizTypes: Record<string, { name: string; summary: string; tactics: string[]; duration: number }> = {
  procrastinator: { name: "The Deadline Sprinter", summary: "You do your best work when there's no option left. The fix isn't more motivation, it's a lower cost to start.", tactics: ["warmup", "pomodoro"], duration: 25 },
  multitasker: { name: "The Multitasker", summary: "You start, but your attention is split across everything at once. Your gains come from environment, not effort.", tactics: ["source", "timelapse"], duration: 25 },
  marathoner: { name: "The Marathoner", summary: "You have the grit. Now protect it with structure: shorter blocks, real breaks, spread across the week.", tactics: ["pomodoro", "doodle"], duration: 50 },
  strategist: { name: "The Architect", summary: "You already plan your time. Your next level is progressive overload: stretch your focus block and test yourself.", tactics: ["timed", "pomodoro"], duration: 50 },
};
export const typeOrder = ["procrastinator", "multitasker", "marathoner", "strategist"];
