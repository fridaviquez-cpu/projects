import "./companion.css";
import type { Session } from "@/lib/store";
import { scoreSessions, tierFor, TIERS } from "@/lib/companion";
import { cn } from "@/lib/utils";

type Mode = "focus" | "rest" | "idle";

function Lion({ level, mode }: { level: number; mode: Mode }) {
  const mane = ["#c9a96a", "#d4a73a", "#c98f1c", "#b8740f"][level];
  const fur = ["#ead9b0", "#efd690", "#f0cf72", "#f2c95a"][level];
  const maneR = [58, 66, 74, 82][level];
  const spikes = [10, 14, 18, 22][level];
  const rest = mode === "rest";
  const focus = mode === "focus";
  const title = `Leo the study guardian, ${TIERS[level].label.toLowerCase()}, ${rest ? "resting on break" : focus ? "focusing" : "ready"}`;
  const pts = Array.from({ length: spikes }, (_, i) => {
    const a = (i / spikes) * Math.PI * 2;
    const r1 = maneR, r2 = maneR - 16;
    const a2 = a + Math.PI / spikes;
    return `${120 + Math.cos(a) * r1},${108 + Math.sin(a) * r1} ${120 + Math.cos(a2) * r2},${108 + Math.sin(a2) * r2}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 240 240" role="img" aria-labelledby="sc-title" className={cn("h-full w-full", `sc-${mode}`)} data-testid="img-companion">
      <title id="sc-title">{title}</title>
      <circle cx="120" cy="112" r="104" fill={rest ? "#2a3550" : "#d4af37"} opacity={rest ? 0.35 : 0.06 + level * 0.05} className="sc-glow" />
      {level >= 2 && !rest && Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <line key={i} x1={120 + Math.cos(a) * 92} y1={108 + Math.sin(a) * 92} x2={120 + Math.cos(a) * 104} y2={108 + Math.sin(a) * 104} stroke="#f0d78c" strokeWidth="3" strokeLinecap="round" opacity=".6" />;
      })}
      <g className="sc-breathe">
        {/* body + shoulders: broader with level */}
        <path d={`M${70 - level * 6} 236 Q${74 - level * 4} 168 120 160 Q${166 + level * 4} 168 ${170 + level * 6} 236Z`} fill={fur} stroke="#6b4a12" strokeWidth="2" />
        {/* Tau T on chest jersey */}
        <path d={`M${84 - level * 4} 236 Q90 182 120 176 Q150 182 ${156 + level * 4} 236Z`} fill="#0b0a08" />
        <path d="M106 196h28M120 196v26" stroke="#d4af37" strokeWidth="5" strokeLinecap="round" />
        {level >= 1 && <path d="M92 176 Q120 192 148 176 L144 186 Q120 200 96 186Z" fill="#d4af37" />}
        {/* mane */}
        <polygon points={pts} fill={mane} stroke="#6b4a12" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="120" cy="108" r={maneR - 14} fill={mane} />
        {/* ears */}
        <circle cx="88" cy="74" r="12" fill={fur} stroke="#6b4a12" strokeWidth="2" />
        <circle cx="152" cy="74" r="12" fill={fur} stroke="#6b4a12" strokeWidth="2" />
        <circle cx="88" cy="74" r="5" fill="#d99a7a" /><circle cx="152" cy="74" r="5" fill="#d99a7a" />
        {/* face */}
        <ellipse cx="120" cy="112" rx="42" ry="44" fill={fur} stroke="#6b4a12" strokeWidth="2" />
        <ellipse cx="120" cy="132" rx="22" ry="16" fill="#fbf1d8" />
        {level >= 1 && !rest && <><circle cx="96" cy="122" r="6" fill="#e8947a" opacity=".45" /><circle cx="144" cy="122" r="6" fill="#e8947a" opacity=".45" /></>}
        {/* eyes */}
        {rest ? (
          <><path d="M98 106 q8 7 16 0" stroke="#2b1d08" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M126 106 q8 7 16 0" stroke="#2b1d08" strokeWidth="3" fill="none" strokeLinecap="round" /></>
        ) : (
          <>
            <ellipse cx="105" cy="104" rx="5.5" ry={focus ? 5 : 6.5} fill="#2b1d08" /><ellipse cx="135" cy="104" rx="5.5" ry={focus ? 5 : 6.5} fill="#2b1d08" />
            <circle cx="107" cy="102" r="1.8" fill="#fff8e6" /><circle cx="137" cy="102" r="1.8" fill="#fff8e6" />
            <path d={focus ? "M96 92 l16 4 M144 92 l-16 4" : "M97 93 q8 -5 16 0 M127 93 q8 -5 16 0"} stroke="#6b4a12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        )}
        {/* nose + mouth */}
        <path d="M113 122 h14 l-7 8z" fill="#5a3410" />
        <path d={rest ? "M114 138 q6 3 12 0" : level >= 2 || mode === "idle" ? "M110 135 q10 10 20 0" : "M113 137 q7 5 14 0"} stroke="#5a3410" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* accessories */}
        {level >= 3 && (
          <g fill="#5f8a3a" stroke="#3d5c22" strokeWidth="1">
            {[-5, -3, -1, 1, 3, 5].map((k) => <ellipse key={k} cx={120 + k * 9} cy={64 + Math.abs(k) * 2} rx="6" ry="3.5" transform={`rotate(${k * 10} ${120 + k * 9} ${64 + Math.abs(k) * 2})`} />)}
          </g>
        )}
        {level >= 2 && !rest && (
          <g><circle cx="105" cy="104" r="11" fill="none" stroke="#0b0a08" strokeWidth="2.5" /><circle cx="135" cy="104" r="11" fill="none" stroke="#0b0a08" strokeWidth="2.5" /><path d="M116 104h8" stroke="#0b0a08" strokeWidth="2.5" /></g>
        )}
        {focus && (
          <g>
            <path d="M84 222 l36 -10 36 10 v-28 l-36 -10 -36 10z" fill="#f5f1e6" stroke="#6b4a12" strokeWidth="2" />
            <path d="M120 212v-28" stroke="#6b4a12" strokeWidth="2" />
            <path d="M92 202 l20 -5 M92 210 l20 -5 M128 197 l20 5 M128 205 l20 5" stroke="#c9b48a" strokeWidth="1.5" />
          </g>
        )}
        {rest && (
          <g>
            <rect x="104" y="196" width="32" height="30" rx="6" fill="#f5f1e6" stroke="#6b4a12" strokeWidth="2" />
            <path d="M136 204 q12 0 12 9 q0 9 -12 9" fill="none" stroke="#6b4a12" strokeWidth="2.5" />
            <path d="M114 190 q-4 -6 0 -12 M126 190 q-4 -6 0 -12" stroke="#f0d78c" strokeWidth="2" fill="none" strokeLinecap="round" className="sc-z" />
          </g>
        )}
        {level >= 1 && mode === "idle" && (
          <path d="M60 236 Q52 200 72 184" stroke={fur} strokeWidth="16" strokeLinecap="round" fill="none" />
        )}
      </g>
      {rest && <text x="170" y="56" fill="#f0d78c" fontFamily="Fraunces, serif" fontSize="18" fontStyle="italic" className="sc-z">z</text>}
    </svg>
  );
}

export function StudyCompanion({ sessions, mode, cue }: { sessions: Session[]; mode: Mode; cue?: string }) {
  const b = scoreSessions(sessions);
  const { tier, index, next, toNext } = tierFor(b.score);
  const pct = next ? (b.score - tier.min) / (next.min - tier.min) : 1;
  const status = mode === "rest" ? "Resting with you. Breaks are part of the work." : mode === "focus" ? "Here with you. No rush." : cue ?? tier.line;
  return (
    <section className="ink-panel overflow-hidden rounded-3xl p-5 sm:p-6" aria-labelledby="sc-h" data-testid="section-companion">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div key={`${index}-${mode}`} className="sc-pop aspect-square w-44 shrink-0 sm:w-48"><Lion level={index} mode={mode} /></div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--paper)]/55">Study guardian · Leo</p>
          <h2 id="sc-h" className="mt-1 font-display text-2xl font-semibold text-[var(--gold-soft)]" data-testid="text-companion-tier">{tier.label}</h2>
          <p className="mt-1 text-sm text-[var(--paper)]/75" aria-live="polite">{status}</p>
          <div className="mt-4">
            <div className="flex justify-between font-mono text-[11px] text-[var(--paper)]/60">
              <span data-testid="text-companion-score">{b.score} habit points</span>
              <span>{next ? `${toNext} to ${next.label}` : "Top tier"}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="Progress to next tier">
              <div className="h-full origin-left rounded-full bg-[var(--gold)] transition-transform duration-700" style={{ transform: `scaleX(${pct})` }} />
            </div>
          </div>
        </div>
      </div>
      <details className="mt-4 rounded-xl bg-white/5 p-3 text-xs text-[var(--paper)]/75">
        <summary className="cursor-pointer font-mono uppercase tracking-[0.15em] text-[var(--paper)]/70">How Leo grows</summary>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono sm:grid-cols-4">
          <div><dt className="text-[var(--paper)]/50">Sessions ×1</dt><dd className="text-[var(--gold-soft)]">{b.sessions}</dd></div>
          <div><dt className="text-[var(--paper)]/50">Recalled +1</dt><dd className="text-[var(--gold-soft)]">{b.recalled}</dd></div>
          <div><dt className="text-[var(--paper)]/50">Practiced +1</dt><dd className="text-[var(--gold-soft)]">{b.practiced}</dd></div>
          <div><dt className="text-[var(--paper)]/50">Takeaway +1</dt><dd className="text-[var(--gold-soft)]">{b.takeaways}</dd></div>
        </dl>
        <p className="mt-3 leading-relaxed">Every completed focus block earns the same 1 point whatever its length, so grinding longer isn't the goal. Check-ins add up to 3 more. Tiers: 0, 4, 12, 24 points. These are self-reported study habits, not a measure of intelligence or health. Leo never loses ground for days off, and deleting a log entry simply recounts.</p>
      </details>
    </section>
  );
}
