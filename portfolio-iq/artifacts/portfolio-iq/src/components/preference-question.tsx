import { Check } from "lucide-react";
import type { Preferences } from "@workspace/api-client-react";
import { getAnswer, setAnswer, type Question } from "@/lib/personalize";
import { cn } from "@/lib/utils";

/** One setup question with native checkboxes/radios. Single-choice answers clear by choosing the selected option again or via Clear. */
export function PreferenceQuestion({ q, value, onChange, compact, idPrefix = "pq", disabled }: { q: Question; value: Preferences; onChange: (p: Preferences) => void; compact?: boolean; idPrefix?: string; disabled?: boolean }) {
  const chosen = getAnswer(value, q.key);
  const toggle = (v: string) => {
    let next: string[];
    if (q.multi) {
      next = chosen.includes(v) ? chosen.filter((x) => x !== v) : [...chosen, v];
      if (q.key === "brokerages" && v === "None" && !chosen.includes("None")) next = ["None"];
      else if (q.key === "brokerages" && v !== "None") next = next.filter((x) => x !== "None");
    } else next = chosen[0] === v ? [] : [v];
    onChange(setAnswer(value, q.key, next));
  };
  const helpId = `${idPrefix}-${q.key}-help`;
  return (
    <fieldset data-testid={`question-${q.key}`} aria-describedby={helpId} disabled={disabled}>
      <legend className={compact ? "text-[15px] font-medium" : "font-display text-3xl leading-tight md:text-4xl"}>{q.title}</legend>
      <p id={helpId} className={cn("text-muted-foreground", compact ? "mt-0.5 text-xs" : "mt-2 text-sm")}>{q.help} {q.multi ? "Choose any." : "Choose one, or none."}</p>
      <div className={cn("grid gap-2 sm:grid-cols-2", compact ? "mt-3" : "mt-6")}>
        {q.options.map((o) => {
          const on = chosen.includes(o.value);
          const id = `${idPrefix}-${q.key}-${o.value.replace(/[^a-z0-9]/gi, "")}`;
          return (
            <label key={o.value} htmlFor={id} data-testid={`option-${q.key}-${o.value}`}
              className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                compact ? "py-2" : "py-3", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/30")}>
              <input id={id} type={q.multi ? "checkbox" : "radio"} name={`${idPrefix}-${q.key}`} value={o.value} checked={on} className="sr-only"
                data-testid={`input-${q.key}-${o.value}`}
                onChange={q.multi ? () => toggle(o.value) : () => undefined}
                onClick={q.multi ? undefined : () => toggle(o.value)} />
              <span aria-hidden className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center border", q.multi ? "rounded" : "rounded-full", on ? "border-accent bg-accent" : "border-input")}>{on && <Check className="h-3 w-3 text-accent-foreground" />}</span>
              <span>
                <span className="block text-sm font-medium">{o.label}</span>
                {o.hint && <span className={cn("mt-0.5 block text-xs", on ? "text-primary-foreground/70" : "text-muted-foreground")}>{o.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {!q.multi && chosen.length > 0 && (
        <button type="button" onClick={() => onChange(setAnswer(value, q.key, []))} className="mt-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground" data-testid={`button-clear-${q.key}`}>Clear this answer</button>
      )}
    </fieldset>
  );
}
