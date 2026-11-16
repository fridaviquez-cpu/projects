import { useState } from "react";
import { Flag, Check } from "lucide-react";
import { useSubmitFeedback, type FeedbackInputCategory } from "@workspace/api-client-react";
import { btnAccent, btnGhost } from "@/components/kit";
import { errMsg } from "@/components/materials-kit";

export const REPORT_CATEGORIES: { value: FeedbackInputCategory; label: string }[] = [
  { value: "scope", label: "Out of course scope" },
  { value: "equation", label: "Wrong equation or math" },
  { value: "solution", label: "Wrong worked solution" },
  { value: "missing", label: "Missing key idea" },
  { value: "diagram", label: "Diagram or figure problem" },
  { value: "citation", label: "Bad or missing citation" },
  { value: "too-basic", label: "Too basic" },
  { value: "too-advanced", label: "Too advanced" },
];

export function ReportControl({ resourceId }: { resourceId: string }) {
  const submit = useSubmitFeedback();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackInputCategory>("equation");
  const [comment, setComment] = useState("");

  if (submit.isSuccess) {
    return <p className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="text-report-sent"><Check className="h-4 w-4 text-accent" /> Thanks. Your report was sent to reviewers.</p>;
  }
  if (!open) {
    return <button onClick={() => setOpen(true)} className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent" data-testid={`button-report-${resourceId}`}><Flag className="h-4 w-4" /> Report a problem</button>;
  }
  const send = () => submit.mutate({ data: { resourceId, category, comment: comment.trim() } });
  return (
    <div className="mt-6 rounded-md border bg-background p-4 rise" data-testid="form-report">
      <p className="font-display font-semibold flex items-center gap-2"><Flag className="h-4 w-4 text-accent" /> Report a problem</p>
      <label className="block mt-3 text-sm font-medium">What is wrong?
        <select value={category} onChange={(e) => setCategory(e.target.value as FeedbackInputCategory)} disabled={submit.isPending} className="mt-1 w-full rounded-md border bg-card p-2.5 text-sm" data-testid="select-report-category">
          {REPORT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
      <label className="block mt-3 text-sm font-medium">Details
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} rows={4} disabled={submit.isPending} data-testid="input-report-comment"
          placeholder="e.g. Step 3 drops the minus sign, so the final cutoff frequency is off."
          className="mt-1 w-full rounded-md border bg-card p-2.5 text-sm outline-none focus:border-accent" />
      </label>
      <p className="text-[11px] text-muted-foreground mt-1">Reviewers will see your comment with the course, topic, and draft ID. Describe the issue in your own words. Do not paste text from your private lecture materials. <span className="font-mono">{comment.length}/2000</span></p>
      {submit.isError && <p role="alert" className="mt-2 text-sm text-destructive">{errMsg(submit.error, "Could not send the report.")}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={send} disabled={!comment.trim() || submit.isPending} className={btnAccent} data-testid="button-submit-report">{submit.isPending ? "Sending..." : "Send report"}</button>
        <button onClick={() => { setOpen(false); submit.reset(); }} className={btnGhost} data-testid="button-cancel-report">Cancel</button>
      </div>
    </div>
  );
}
