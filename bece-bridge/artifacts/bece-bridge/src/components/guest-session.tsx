import { useEffect, useState, type ReactNode } from "react";
import { initializeGuest, checkGuestSession } from "@workspace/api-client-react";
import { ErrorState } from "./kit";

let initialization: Promise<void> | undefined;
function initialize(): Promise<void> {
  if (!initialization) {
    const start = async () => {
      await initializeGuest({ credentials: "include" });
      // Check the cookie was actually accepted before mounting personal queries.
      await checkGuestSession({ credentials: "include" });
    };
    initialization = (async () => {
      if (navigator.locks) await navigator.locks.request("bece-browser-session", start);
      else await start();
    })().catch(error => { initialization = undefined; throw error; });
  }
  return initialization;
}

export function GuestSession({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    initialize().then(() => { if (active) setState("ready"); }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [attempt]);
  if (state === "loading") return <div className="p-10" role="status">Preparing your learning workspace…</div>;
  if (state === "error") return <div className="p-10"><ErrorState title="Could not start your workspace. Allow cookies, then retry." onRetry={() => { setState("loading"); setAttempt(n => n + 1); }} /></div>;
  return children;
}
