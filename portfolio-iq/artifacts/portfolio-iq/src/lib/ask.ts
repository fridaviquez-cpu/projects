import type { QuestionInput } from "@workspace/api-client-react";

export type AssistantMode = NonNullable<QuestionInput["mode"]>;
export const ASK_EVENT = "portfolioiq:ask";

/** Public lesson/topic text only. Opening a question never sends it to AI. */
export function askAbout(text: string) {
  window.dispatchEvent(new CustomEvent<string>(ASK_EVENT, { detail: text.slice(0, 2000) }));
}

export function modeFor(path: string): AssistantMode {
  if (path.startsWith("/learn") || path.startsWith("/resources")) return "Learn";
  if (path.startsWith("/thesis")) return "Thesis";
  if (path.startsWith("/wealth")) return "Wealth";
  return "Portfolio";
}
