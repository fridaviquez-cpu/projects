import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { useAskTutor, useDeleteTutorConversation, useGetTutorConversation, type Resource, type TutorQuestion } from "@workspace/api-client-react";
import { Markdown, Sources, btnAccent, btnGhost } from "@/components/kit";
import { errMsg } from "@/components/materials-kit";
import { VisualsPanel } from "@/components/visuals-panel";
import { ActiveEvidence, EvidenceProvider } from "@/components/evidence-context";

const modeNames = { teach: "Teach Me", guided: "Guide Me", solution: "Show Solution", challenge: "Challenge Me" };
export function TutorConversation({ resource }: { resource: Resource }) {
  const { user, isAuthenticated } = useAuth();
  if (resource.materialIds?.length && !isAuthenticated) return null;
  // A different account must never inherit an in-flight answer, draft or query cache.
  return <Conversation key={`${resource.id}:${user?.id ?? "guest"}`} resource={resource} account={user?.id ?? "guest"} />;
}

function Conversation({ resource, account }: { resource: Resource; account: string }) {
  const qc = useQueryClient();
  const key = ["tutor", resource.id, account];
  const history = useGetTutorConversation(resource.id, { query: { queryKey: key, staleTime: 0, retry: false } });
  const ask = useAskTutor();
  const clear = useDeleteTutorConversation();
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<TutorQuestion["mode"]>("guided");
  const [consent, setConsent] = useState(false);
  const [visual, setVisual] = useState<string | null>(null);
  const privateSource = !!resource.materialIds?.length;
  const send = () => {
    if (!history.data || !question.trim() || ask.isPending) return;
    ask.mutate({ id: resource.id, data: { question: question.trim(), mode, revision: history.data.revision, processingConsent: consent } }, {
      onSuccess: data => { qc.setQueryData(key, data); setQuestion(""); },
      onError: () => { void history.refetch(); },
    });
  };
  return (
    <section className="mt-8 border-t pt-6" aria-labelledby={`tutor-${resource.id}`} data-testid="tutor-conversation">
      <h3 id={`tutor-${resource.id}`} className="font-display text-xl font-bold">Ask a follow-up</h3>
      <p className="text-sm text-muted-foreground mt-2">
        ECE {resource.courseId} · {resource.topic}. This conversation keeps the original explanation,
        selected sources and all previous turns. Reopen this resource in Library to continue.
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        {privateSource ? resource.sourceMode === "combined" ? "Answers use your selected lecture materials and relevant shared instructional selections." : "Answers use only your selected lecture materials." : "No private lectures selected. Answers use available original BECE lessons and shared instructional selections, not instructor-reviewed course notes."}
        {" "}Citations establish provenance, not mathematical correctness. Up to 20 follow-ups per conversation; generation limits apply.
        {" "}Tutoring is paused during an unfinished scored check.
      </p>
      {history.isLoading && <p role="status" className="mt-4">Loading conversation…</p>}
      {history.isError && <p role="alert" className="mt-4 text-destructive">{errMsg(history.error)}</p>}
      <div className="space-y-5 my-5" aria-live="polite">
        {!history.isError && history.data?.turns.map((turn, i) => (
          <div key={i} className="rounded-lg border bg-background p-4" data-testid={`tutor-turn-${i}`}>
            <p className="text-xs font-mono text-muted-foreground mb-2">YOU · {modeNames[turn.mode]}</p>
            <p className="font-semibold whitespace-pre-wrap mb-4">{turn.question}</p>
            {!turn.supported && <p className="rounded bg-accent/10 px-3 py-2 mb-3 text-sm font-semibold">Source limitation</p>}
            <Markdown>{turn.answer}</Markdown>
            {!!turn.sources.length && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">Source references ({turn.sources.length})</summary><div className="mt-3"><Sources sources={turn.sources} /></div></details>}
            {turn.visualPrompt && <button type="button" className={`${btnGhost} mt-4`} onClick={() => setVisual(turn.visualPrompt!)}>Explore this concept visually</button>}
          </div>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); send(); }} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {["Explain that more simply.", "Explain the equation step by step.", "Why was that mathematical operation used?", "Give another worked example.", "Give me a related practice question.", "Visualize this concept with adjustable parameters."].map(s => (
            <button key={s} type="button" disabled={ask.isPending} className="rounded-full border px-3 py-1.5 text-xs hover:border-accent" onClick={() => setQuestion(s)}>{s}</button>
          ))}
        </div>
        <label className="block text-sm font-medium">Teaching mode
          <select value={mode} disabled={ask.isPending} onChange={e => setMode(e.target.value as TutorQuestion["mode"])} className="block mt-1 w-full rounded border bg-background p-2">
            {Object.entries(modeNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">{{ teach: "Explain the concept clearly.", guided: "Hints and guiding questions without revealing the final answer.", solution: "A complete study solution with steps, assumptions and units.", challenge: "A fresh practice question; try it before asking for the answer." }[mode]}</p>
        <label className="block text-sm font-medium">Your follow-up question
          <textarea value={question} maxLength={2000} rows={3} onChange={e => setQuestion(e.target.value)} disabled={ask.isPending}
            className="block mt-1 w-full rounded border bg-background p-3" placeholder="Which step is unclear? What would you like to explore next?" />
        </label>
        {privateSource && <label className="flex gap-2 text-sm items-start"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />I authorize AI processing of these selected private materials for this conversation.</label>}
        {ask.isError && <p role="alert" className="text-sm text-destructive">{errMsg(ask.error)}</p>}
        {clear.isError && <p role="alert" className="text-sm text-destructive">{errMsg(clear.error)}</p>}
        <div className="flex flex-wrap gap-3">
          <button className={btnAccent} type="submit" disabled={!question.trim() || !history.data || history.isError || ask.isPending || clear.isPending || (privateSource && !consent) || history.data.turns.length >= 20}>{ask.isPending ? "Thinking with your sources…" : "Ask follow-up"}</button>
          <button type="button" className={btnGhost} disabled={ask.isPending} onClick={() => { ask.reset(); void history.refetch(); }}>Refresh conversation</button>
          <button type="button" className={btnGhost} disabled={ask.isPending || clear.isPending || !history.data?.turns.length} onClick={() => {
            if (window.confirm("Delete this conversation history? Your original explanation and lecture materials will be kept.")) {
              clear.mutate({ id: resource.id }, { onSuccess: data => { qc.setQueryData(key, data); setQuestion(""); setVisual(null); ask.reset(); } });
            }
          }}>Delete conversation</button>
        </div>
      </form>
      {visual && <div className="mt-6 rounded-lg border p-4">
        <div className="flex justify-between gap-4 mb-4"><h4 className="font-semibold">Visualize this conversation</h4><button type="button" className={btnGhost} onClick={() => setVisual(null)}>Close visual</button></div>
        <EvidenceProvider key={visual} courseId={resource.courseId ?? "210"} setCourseId={() => {}} initialMaterialIds={resource.materialIds ?? []} initialMode={resource.sourceMode}>
          <ActiveEvidence />
          <VisualsPanel courseId={resource.courseId ?? "210"} initialPrompt={visual} initialMaterialIds={resource.materialIds ?? []} />
        </EvidenceProvider>
      </div>}
    </section>
  );
}
