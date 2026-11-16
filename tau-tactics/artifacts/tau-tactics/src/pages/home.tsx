import { Link } from "wouter";
import { ArrowRight, BookOpen, Compass, Library, Sparkles, Timer } from "lucide-react";
import { KEYS, useLocal, type Plan, type QuizResult, type Session } from "@/lib/store";
import { quizTypes, TOOLKIT_DRIVE } from "@/lib/content";
import { useTimer } from "@/lib/timer";
import { btn, DeviceNote } from "@/components/shell";
import { format, isToday, startOfWeek } from "date-fns";
import { ReviewHome } from "@/components/review-home";

const takeaways = [
  ["Focus is a skill,", "not a personality trait. Train it like one."],
  ["Your environment controls your discipline.", "Design it before you rely on willpower."],
  ["Start small", "to build momentum. Two minutes beats zero."],
  ["AI should enhance thinking,", "not replace it. Amplifier, not shortcut."],
  ["Consistency creates results.", "The system you repeat beats the plan you admire."],
];

export default function Home() {
  const [sessions] = useLocal<Session[]>(KEYS.sessions, []);
  const [plans] = useLocal<Plan[]>(KEYS.plans, []);
  const [favs] = useLocal<string[]>(KEYS.favorites, []);
  const [quiz] = useLocal<QuizResult | null>(KEYS.quiz, null);
  const { state } = useTimer();

  const today = sessions.filter((s) => isToday(s.completedAt));
  const week = sessions.filter((s) => s.completedAt >= startOfWeek(new Date(), { weekStartsOn: 1 }).getTime());
  const weekMin = week.reduce((a, s) => a + s.minutes, 0);
  const longest = sessions.reduce((a, s) => Math.max(a, s.minutes), 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  const next: { href: string; title: string; body: string; icon: typeof Timer }[] = [];
  if (state.status === "running" || state.status === "paused") next.push({ href: "/focus", title: "Return to your session", body: `"${state.task || "Untitled"}" is ${state.status}.`, icon: Timer });
  if (!quiz) next.push({ href: "/plan#quiz", title: "Take the five-question habits quiz", body: "An honest read on how you study, plus the tactics that fit.", icon: Compass });
  if (plans.length === 0) next.push({ href: "/plan", title: "Build your study system", body: "Four choices, one protocol you can run tonight.", icon: Compass });
  if (today.length === 0) next.push({ href: "/focus", title: "Run one focus block", body: "Phone away, one task, timer on. Start with what you have.", icon: Timer });
  next.push({ href: "/learn", title: "Read the six tactics", body: "How to run each one and why it tends to work.", icon: BookOpen });
  next.push({ href: "/ai", title: "Build a study prompt", body: "Explain, practice, or check-my-work, ready to paste.", icon: Sparkles });

  return (
    <div>
      <section className="ink-panel rise relative overflow-hidden rounded-3xl p-7 sm:p-10">
        <span aria-hidden className="font-display pointer-events-none absolute -right-6 -top-10 select-none text-[11rem] font-bold leading-none text-[var(--gold)]/10 sm:text-[16rem]">TAU</span>
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">{greet} · {format(new Date(), "EEEE, MMM d")}</p>
        <h1 className="font-display mt-4 max-w-xl text-4xl font-semibold leading-[1.05] sm:text-6xl">
          You don't lack intelligence. You lack <em className="text-[var(--gold)]">systems.</em>
        </h1>
        <p className="mt-4 max-w-lg text-[var(--paper)]/70">Study smarter. Focus longer. Learn better. Your personal space for discipline, hosted by the Tau Chapter at the University of Illinois Urbana-Champaign.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/focus" className={btn.gold} data-testid="link-start-focus"><Timer className="h-4 w-4" /> Start a focus session</Link>
          <Link href="/plan" className="inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/40 px-5 py-2.5 text-sm text-[var(--paper)] transition-colors hover:bg-white/5" data-testid="link-build-plan">Build my study system <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <div className="mt-8"><ReviewHome /></div>
      <section className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4" aria-label="Your stats">
        {[
          ["Today", today.length, today.length === 1 ? "focus block" : "focus blocks"],
          ["This week", weekMin, "focused minutes"],
          ["Longest block", longest, "minutes"],
          ["All time", sessions.length, "blocks completed"],
        ].map(([k, v, u]) => (
          <div key={k as string} className="bg-card p-5" data-testid={`stat-${(k as string).toLowerCase().replace(/\s/g, "-")}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{k}</p>
            <p className="font-display mt-2 text-4xl font-semibold tabular-nums">{v}</p>
            <p className="text-xs text-muted-foreground">{u}</p>
          </div>
        ))}
      </section>
      <div className="mt-2"><DeviceNote>Stats come only from sessions you complete here, saved on this device.</DeviceNote></div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="min-w-0">
          <h2 className="font-display text-2xl font-semibold">Next moves</h2>
          <ul className="mt-4 space-y-2">
            {next.slice(0, 4).map((n, i) => (
              <li key={n.title} className="rise" style={{ animationDelay: `${i * 60}ms` }}>
                <Link href={n.href} data-testid={`link-next-${i}`} className="lift group flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary"><n.icon className="h-4 w-4" /></span>
                  <span className="flex-1"><span className="block font-medium">{n.title}</span><span className="text-sm text-muted-foreground">{n.body}</span></span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>

          <h2 className="font-display mt-10 text-2xl font-semibold">Recent focus</h2>
          {sessions.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="font-display text-xl italic">Your log is blank, and that's honest.</p>
              <p className="mt-1 text-sm text-muted-foreground">Completed focus blocks appear here. Nothing is pre-filled.</p>
              <Link href="/focus" className={`${btn.primary} mt-4`} data-testid="link-empty-focus">Start the first one</Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
              {sessions.slice(0, 5).map((s) => (
                <li key={s.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4" data-testid={`row-session-${s.id}`}>
                  <span className="truncate">{s.task}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{s.minutes}m · {format(s.completedAt, "MMM d, h:mm a")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Your student type</p>
            {quiz ? (
              <>
                <p className="font-display mt-2 text-2xl font-semibold">{quizTypes[quiz.type]?.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{quizTypes[quiz.type]?.summary}</p>
                <Link href="/plan#quiz" className="mt-3 inline-block text-sm underline decoration-[var(--gold)] underline-offset-4" data-testid="link-quiz-result">See full result</Link>
              </>
            ) : <p className="mt-2 text-sm text-muted-foreground">Not taken yet. <Link href="/plan#quiz" className="underline decoration-[var(--gold)] underline-offset-4" data-testid="link-take-quiz">Five questions</Link>.</p>}
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Saved</p>
            <p className="mt-2 text-sm"><span className="font-display text-2xl font-semibold">{plans.length}</span> plans · <span className="font-display text-2xl font-semibold">{favs.length}</span> bookmarks</p>
            <div className="mt-3 flex gap-3 text-sm">
              <Link href="/plan" className="underline decoration-[var(--gold)] underline-offset-4" data-testid="link-plans">Plans</Link>
              <Link href="/toolkit" className="underline decoration-[var(--gold)] underline-offset-4" data-testid="link-bookmarks">Toolkit</Link>
            </div>
          </div>
          <a href={TOOLKIT_DRIVE} target="_blank" rel="noreferrer" data-testid="link-drive-toolkit" className="ink-panel lift flex items-center gap-3 rounded-2xl p-5">
            <Library className="h-5 w-5 text-[var(--gold)]" />
            <span className="flex-1 text-sm"><span className="block font-medium">The full Student Toolkit, free</span><span className="text-[var(--paper)]/60">Opens Google Drive</span></span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </aside>
      </div>

      <section className="mt-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">Key takeaways</p>
        <h2 className="font-display mt-2 text-3xl font-semibold">Lock in. Stay disciplined. <em>Execute.</em></h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {takeaways.map(([b, r], i) => (
            <li key={b} className="rounded-2xl border border-border bg-card p-4 text-sm">
              <span className="font-display text-3xl text-gold">{i + 1}</span>
              <p className="mt-2"><strong>{b}</strong> {r}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
