import { useMemo, useState, type ReactNode } from "react";
import { ExternalLink, ShieldCheck, X } from "lucide-react";
import { aiTasks, aiTools, wrongWays } from "@/lib/content";
import { CopyButton, PageHeader } from "@/components/shell";
import { KEYS, useLocal } from "@/lib/store";
import { cn } from "@/lib/utils";

const checklist = [
  { id: "verify", t: "Verify", b: "Open the citations, re-derive the key step, and check against your course materials. AI can be confidently wrong." },
  { id: "privacy", t: "Protect privacy", b: "Don't paste personal info, other students' work, or anything your instructor shared as confidential." },
  { id: "rules", t: "Follow course rules", b: "Check each syllabus's AI policy. When unsure, ask your instructor before using AI on graded work." },
  { id: "think", t: "Think first", b: "Attempt the problem before prompting. Close the chat and explain it back in your own words." },
];

type Mode = "explain" | "practice" | "check";

function buildPrompt(mode: Mode, course: string, topic: string, level: string, depth: string, work: string) {
  const c = course.trim() || "[course]";
  const t = topic.trim() || "[topic or problem]";
  if (mode === "explain")
    return `I'm a student in ${c}. Help me understand: ${t}\n\nMy current level: ${level}. Depth: ${depth}.\n\n1. Restate the idea in plain language.\n2. Explain it step by step; don't skip steps at my level.\n3. Give one concrete example and one common mistake.\n4. Ask me two questions to check my understanding, then wait for my answers.\n\nDo not just give me a final answer; teach me the reasoning.`;
  if (mode === "practice")
    return `I'm studying ${c}, topic: ${t}. My level: ${level}.\n\nWrite 5 practice problems that increase in difficulty. Show only the questions first. After I answer each one, tell me whether I'm right, where my reasoning broke if not, and give a hint before the full solution. Depth of feedback: ${depth}.`;
  return `I'm studying ${c}, topic: ${t}. Here is my attempt:\n\n${work.trim() || "[paste your own work here]"}\n\nCheck my work. Do NOT rewrite it for me. Instead:\n1. Point to the first step where something goes wrong, if any.\n2. Explain why it's wrong in ${depth} detail.\n3. Give me a hint so I can fix it myself.\n4. If it's correct, tell me one way to verify it independently.`;
}

export default function AI() {
  const [task, setTask] = useState<string | null>(null);
  const [tab, setTab] = useState(aiTools[0].id);
  const [checks, setChecks] = useLocal<string[]>("tau.aichecks.v1", []);
  const [favs, setFavs] = useLocal<string[]>(KEYS.favorites, []);
  const [mode, setMode] = useState<Mode>("explain");
  const [course, setCourse] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("some exposure");
  const [depth, setDepth] = useState("standard");
  const [work, setWork] = useState("");
  const tool = aiTools.find((t) => t.id === tab)!;
  const matches = task ? aiTools.filter((t) => t.tasks.includes(task)).map((t) => t.id) : [];
  const prompt = useMemo(() => buildPrompt(mode, course, topic, level, depth, work), [mode, course, topic, level, depth, work]);
  const favKey = `ai-${tool.id}`;

  return (
    <div>
      <PageHeader kicker="03 · The AI playbook" title={<>The right tool for the right <em>task.</em></>}>
        AI should enhance your thinking, never replace it. These are prompts the chapter actually uses. This page doesn't generate answers; it helps you write better prompts to bring into the tool you choose.
      </PageHeader>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl font-semibold">What are you trying to do?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {aiTasks.map((t) => (
            <button key={t.id} onClick={() => { setTask(task === t.id ? null : t.id); const m = aiTools.find((x) => x.tasks.includes(t.id)); if (m && task !== t.id) setTab(m.id); }}
              aria-pressed={task === t.id} data-testid={`button-task-${t.id}`}
              className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-all active:scale-95", task === t.id ? "border-[var(--gold)] bg-[var(--gold)] text-[var(--ink)]" : "border-border hover:border-[var(--gold)]")}>{t.label}</button>
          ))}
        </div>
        {task && <p className="mt-3 text-sm text-muted-foreground">Best match: <strong className="text-foreground">{aiTools.filter((t) => matches.includes(t.id)).map((t) => t.name).join(" or ")}</strong></p>}
      </section>

      <div className="mt-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1" role="tablist">
        {aiTools.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`tab-ai-${t.id}`}
            className={cn("relative whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors", tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}>
            {t.name}{matches.includes(t.id) && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--gold)] align-middle" />}
          </button>
        ))}
      </div>

      <section key={tool.id} className="rise mt-4 grid gap-6 lg:grid-cols-[1fr_1.2fr]" role="tabpanel">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Best for</p>
          <h3 className="font-display text-3xl font-semibold">{tool.best}</h3>
          <div className="mt-3 flex flex-wrap gap-1.5">{tool.tags.map((g) => <span key={g} className="rounded-md bg-secondary px-2 py-1 text-xs">{g}</span>)}</div>
          <p className="mt-4 text-sm text-muted-foreground">{tool.note}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={tool.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:border-[var(--gold)]" data-testid={`link-open-${tool.id}`}>Open {tool.id === "chatgpt" ? "ChatGPT" : tool.name} <ExternalLink className="h-3.5 w-3.5" /></a>
            {"url2" in tool && tool.url2 && <a href={tool.url2} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:border-[var(--gold)]" data-testid="link-open-gemini">Open Gemini <ExternalLink className="h-3.5 w-3.5" /></a>}
            <button onClick={() => setFavs(favs.includes(favKey) ? favs.filter((f) => f !== favKey) : [...favs, favKey])} className="rounded-full px-3 py-1.5 text-sm underline decoration-[var(--gold)] underline-offset-4" data-testid={`button-fav-${tool.id}`}>{favs.includes(favKey) ? "Saved prompt" : "Save prompt"}</button>
          </div>
        </div>
        <div className="ink-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">{tool.label}</p>
            <CopyButton text={tool.prompt} testId={`button-copy-${tool.id}`} className="border-white/20 bg-transparent text-[var(--paper)]" />
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-[var(--paper)]/85">{tool.prompt}</pre>
        </div>
      </section>

      <section className="mt-14" id="builder">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">Prompt builder</p>
        <h2 className="font-display mt-2 text-3xl font-semibold">Write a prompt that makes you <em>think.</em></h2>
        <p className="mt-2 text-sm text-muted-foreground">Fill in the blanks, copy the result, and paste it into the AI tool of your choice. Nothing is sent anywhere from here.</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="grid grid-cols-3 gap-1 rounded-full bg-secondary p-1">
              {(["explain", "practice", "check"] as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} data-testid={`button-mode-${m}`}
                  className={cn("rounded-full py-2 text-sm capitalize transition-all", mode === m ? "bg-card shadow-sm font-medium" : "text-muted-foreground")}>{m === "check" ? "Check my work" : m}</button>
              ))}
            </div>
            <Field label="Course"><input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. ECE 330" className={inputCls} data-testid="input-course" /></Field>
            <Field label="Topic or problem"><textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} placeholder="e.g. Fourier transform time-shift property" className={inputCls} data-testid="input-topic" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="My level"><select value={level} onChange={(e) => setLevel(e.target.value)} className={inputCls} data-testid="select-level"><option>beginner</option><option>some exposure</option><option>comfortable</option></select></Field>
              <Field label="Depth"><select value={depth} onChange={(e) => setDepth(e.target.value)} className={inputCls} data-testid="select-depth"><option>very detailed</option><option>standard</option><option>quick</option></select></Field>
            </div>
            {mode === "check" && <Field label="My attempt"><textarea value={work} onChange={(e) => setWork(e.target.value)} rows={4} placeholder="Paste your own work. Do the attempt first." className={inputCls} data-testid="input-work" /></Field>}
          </div>
          <div className="flex flex-col rounded-2xl border-2 border-dashed border-[var(--gold)]/60 bg-card p-5">
            <div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Your prompt, ready to paste</p><CopyButton text={prompt} testId="button-copy-built" label="Copy prompt" /></div>
            <pre className="mt-3 flex-1 whitespace-pre-wrap font-mono text-[13px] leading-relaxed" data-testid="text-built-prompt">{prompt}</pre>
          </div>
        </div>
      </section>

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl font-semibold">Using AI the wrong way</h2>
          <ul className="mt-4 space-y-3">
            {wrongWays.map((w) => <li key={w.t} className="flex gap-3 text-sm"><X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span><strong>{w.t}</strong> {w.b}</span></li>)}
          </ul>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Responsible-use check</h2><span className="font-mono text-xs text-muted-foreground">{checks.length}/4</span></div>
          <ul className="mt-3 space-y-2">
            {checklist.map((c) => {
              const on = checks.includes(c.id);
              return (
                <li key={c.id}><label className="flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-secondary">
                  <input type="checkbox" checked={on} onChange={() => setChecks(on ? checks.filter((x) => x !== c.id) : [...checks, c.id])} className="mt-1 h-4 w-4 accent-[#d4af37]" data-testid={`checkbox-ai-${c.id}`} />
                  <span className="text-sm"><strong>{c.t}.</strong> <span className="text-muted-foreground">{c.b}</span></span>
                </label></li>
              );
            })}
          </ul>
          {checks.length === 4 && <p className="rise mt-2 flex items-center gap-2 text-sm text-gold"><ShieldCheck className="h-4 w-4" /> Amplifier, not autopilot.</p>}
        </section>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
