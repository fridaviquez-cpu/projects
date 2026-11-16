import { useEffect, useRef, useState } from "react";
import { discardAssessment, getUnfinishedAssessment, startAssessment, submitAssessment,
  type Assessment, type AssessmentInputMode, type AssessmentResult } from "@workspace/api-client-react";

type Course = "110" | "120" | "210" | "220";
type Draft = { id: string; courseId: string; answers: Record<string, string> };
const key = (course: string) => `bridge-check-draft-v1:${course}`;

function read(course: string): Draft | null {
  const raw = localStorage.getItem(key(course));
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value?.courseId !== course || typeof value.id !== "string" ||
      !value.answers || typeof value.answers !== "object" || Array.isArray(value.answers) ||
      Object.values(value.answers).some(v => typeof v !== "string")) {
    throw new Error("Invalid draft");
  }
  return value;
}

export function useCheckDraft(courseId: string, onCompleted: () => void) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const mounted = useRef(true);
  const revision = useRef(0);
  const locked = useRef(false);
  const course = courseId as Course;

  useEffect(() => {
    mounted.current = true;
    const load = () => {
      revision.current++;
      try { setDraft(read(courseId)); }
      catch { setStorageWarning("Saved answers could not be read. Browser storage may be unavailable or damaged."); }
      setAssessment(null); setAnswers({}); setResult(null); setReady(true);
    };
    load();
    const changed = (e: StorageEvent) => {
      if (e.key === key(courseId) || e.key === null) {
        load();
        setMessage("This course's draft changed in another tab. Resume it before continuing.");
      }
    };
    window.addEventListener("storage", changed);
    return () => { mounted.current = false; window.removeEventListener("storage", changed); };
  }, [courseId]);

  const save = (value: Draft) => {
    try { localStorage.setItem(key(courseId), JSON.stringify(value)); }
    catch { if (mounted.current) setStorageWarning("Answers cannot be saved in this browser. Keep this page open to avoid losing them."); }
    if (mounted.current) setDraft(value);
  };
  const clear = (id: string) => {
    try {
      const stored = read(courseId);
      if (stored && stored.id !== id) {
        if (mounted.current) {
          setDraft(stored); setAssessment(null); setAnswers({}); setResult(null);
          setMessage("Another tab saved a newer check. Resume it before continuing.");
        }
        return false;
      }
      if (stored?.id === id) localStorage.removeItem(key(courseId));
    }
    catch { if (mounted.current) setStorageWarning("Could not clear browser storage. An old draft may appear after refresh; it cannot be resumed once completed or discarded."); }
    if (mounted.current) { setDraft(null); setAssessment(null); setAnswers({}); }
    return true;
  };
  const run = async (work: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage("");
    try { await work(); }
    catch (error) {
      if (mounted.current) {
        const status = (error as { status?: number }).status;
        setMessage(status === 404 || status === 409
          ? "This saved check is no longer available or was already completed. Discard it to start a fresh check."
          : "Could not connect. Your answers are still here; please try again.");
      }
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  const begin = (mode: AssessmentInputMode) => {
    if (!ready || draft || (assessment && !result)) {
      setMessage("Resume or discard your unfinished check before starting another.");
      return;
    }
    void run(async () => {
      const version = revision.current;
      const adoptStoredDraft = () => {
        try {
          const stored = read(courseId);
          if (stored || revision.current !== version) {
            if (mounted.current) {
              setDraft(stored); setAssessment(null); setAnswers({}); setResult(null);
              setMessage("Another tab changed this course's draft. Resume or discard it before starting another.");
            }
            return true;
          }
        } catch {
          if (mounted.current) setStorageWarning("Browser storage is unavailable. Keep this page open to avoid losing answers.");
        }
        return false;
      };
      if (adoptStoredDraft()) return;
      const a = await startAssessment({ mode, courseId: course });
      if (adoptStoredDraft()) {
        // This unshown check lost the race; do not replace the other tab's answers.
        await discardAssessment(course, a.id);
        return;
      }
      save({ id: a.id, courseId, answers: {} });
      if (mounted.current) { setAssessment(a); setAnswers({}); setResult(null); }
    });
  };
  const resume = () => void run(async () => {
    if (!draft) return;
    const version = revision.current;
    const a = await getUnfinishedAssessment(course, draft.id);
    if (!mounted.current || version !== revision.current) return;
    setAssessment(a);
    setAnswers(Object.fromEntries(a.questions.map(q => [q.id, draft.answers[q.id] ?? ""])));
    setResult(null);
  });
  const discard = () => void run(async () => {
    if (!draft) return;
    await discardAssessment(course, draft.id);
    const cleared = clear(draft.id);
    if (mounted.current && cleared) setResult(null);
  });
  const changeAnswer = (id: string, value: string) => {
    if (!assessment || result || locked.current) return;
    const next = { ...answers, [id]: value };
    setAnswers(next);
    save({ id: assessment.id, courseId, answers: next });
  };
  const send = () => void run(async () => {
    if (!assessment || result || assessment.courseId !== courseId ||
        !assessment.questions.every(q => answers[q.id]?.trim() && Number.isFinite(Number(answers[q.id])))) return;
    // Revalidate ownership/completion after refresh and before sending saved answers.
    const version = revision.current;
    await getUnfinishedAssessment(course, assessment.id);
    if (!mounted.current || version !== revision.current) return;
    const r = await submitAssessment({ assessmentId: assessment.id,
      answers: assessment.questions.map(q => ({ questionId: q.id, value: Number(answers[q.id]) })) });
    // Clear even after navigation, but never clear a newer draft for this course.
    const completedAssessment = assessment;
    const cleared = clear(assessment.id);
    onCompleted();
    if (mounted.current && cleared && version === revision.current) { setAssessment(completedAssessment); setAnswers(answers); setResult(r); }
  });
  return { draft, assessment, answers, result, busy, ready, message, storageWarning,
    begin, resume, discard, changeAnswer, send };
}
