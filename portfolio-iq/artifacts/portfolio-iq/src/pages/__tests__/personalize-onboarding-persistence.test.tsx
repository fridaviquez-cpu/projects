import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Onboarding from "../onboarding";
import { answers, checked, click, disabled, persistenceHarness, prefsKey, workspaceKey } from "@/test/personalization-harness";

const h = persistenceHarness();
async function mount() {
  const view = h.mount(<Onboarding />, "/onboarding");
  await h.loaded();
  await screen.findByTestId("question-experience");
  return view;
}

function finishSteps() {
  for (let step = 1; step < 7; step++) click("button-onboarding-next");
  expect(screen.getByTestId("text-onboarding-step").textContent).toBe("Personalize · 7 of 7");
}

describe("Onboarding preferences persistence", () => {
  it("recovers from load failure without presenting or saving an empty setup", async () => {
    h.seed(answers({ experience: "experienced", status: "completed" }));
    h.failLoad();
    h.mount(<Onboarding />, "/onboarding");
    expect(screen.getByLabelText("Loading").getAttribute("aria-busy")).toBe("true");
    expect((await screen.findByRole("alert")).textContent).toContain("Your setup answers didn't load");
    expect(screen.queryByTestId("button-skip-onboarding")).toBeNull();
    expect(h.writes).toEqual([]);
    h.failLoad(false);
    click("button-retry");
    await h.loaded();
    await screen.findByTestId("question-experience");
    expect(checked("experience", "experienced")).toBe(true);
  });

  it("retains the step and full unsaved draft through refetch and failed finish, then saves it on retry", async () => {
    h.seed(answers({ experience: "basics", goals: ["Learning"], status: "skipped" }));
    const { location } = await mount();
    click("input-experience-regular");
    click("button-onboarding-next");
    click("input-objectives-wealth");
    await h.refetch(answers({ experience: "experienced", goals: ["Retirement"], status: "completed" }));
    expect(screen.getByTestId("text-onboarding-step").textContent).toBe("Personalize · 2 of 7");
    expect(checked("objectives", "wealth")).toBe(true);
    click("button-onboarding-back");
    expect(checked("experience", "regular")).toBe(true);
    finishSteps();
    click("input-learning-visual");
    h.failSave();
    click("button-finish-onboarding");
    expect((await screen.findByTestId("status-onboarding-error")).textContent).toContain("Your answers are still here");
    expect(location.history).toEqual(["/onboarding"]);
    expect(checked("learning", "visual")).toBe(true);
    expect(h.saved.experience).toBe("experienced");
    expect(h.client.getQueryState(workspaceKey)?.isInvalidated).toBe(false);
    const expected = answers({
      experience: "regular", objectives: ["wealth"], goals: ["Learning"],
      learning: ["visual"], status: "completed",
    });
    expect(h.writes).toEqual([expected]);
    h.failSave(false);
    const release = h.pauseSave();
    click("button-finish-onboarding");
    await waitFor(() => expect(h.writes).toHaveLength(2));
    expect(disabled("button-finish-onboarding")).toBe(true);
    expect(disabled("button-onboarding-back")).toBe(true);
    expect(disabled("button-skip-onboarding")).toBe(true);
    expect(screen.getByTestId("question-learning").hasAttribute("disabled")).toBe(true);
    click("button-finish-onboarding");
    await act(async () => { release(); });
    await h.savedAs(expected);
    await waitFor(() => expect(location.history).toEqual(["/onboarding", "/"]));
    expect(h.writes).toEqual([expected, expected]);
    expect(screen.queryByTestId("status-onboarding-error")).toBeNull();
  });

  it("cancels skip with the draft intact; confirmed skip retries safely and preserves the latest saved answers, not the draft", async () => {
    h.seed(answers({ experience: "basics", goals: ["Learning"], status: "completed" }));
    const { location } = await mount();
    click("input-experience-new");
    click("button-skip-onboarding");
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    click("button-keep-answering");
    expect(checked("experience", "new")).toBe(true);
    expect(h.writes).toEqual([]);
    expect(location.history).toEqual(["/onboarding"]);
    const latest = answers({ experience: "experienced", goals: ["Retirement"], horizon: "5-10", status: "completed" });
    await h.refetch(latest);
    h.failSave();
    click("button-skip-onboarding");
    click("button-confirm-skip");
    await screen.findByTestId("status-onboarding-error");
    expect(checked("experience", "new")).toBe(true);
    expect(h.client.getQueryData(prefsKey)).toEqual(latest);
    expect(location.history).toEqual(["/onboarding"]);
    h.failSave(false);
    click("button-skip-onboarding");
    click("button-confirm-skip");
    await h.savedAs({ ...latest, status: "skipped" });
    await waitFor(() => expect(location.history).toEqual(["/onboarding", "/"]));
    expect(h.writes).toEqual([1, 2].map(() => ({ ...latest, status: "skipped" })));
  });

  it.each(["skipped", "completed"] as const)("persists explicitly %s empty setup with a distinct status", async (status) => {
    const { location, unmount } = await mount();
    if (status === "skipped") click("button-skip-onboarding");
    else {
      finishSteps();
      click("button-finish-onboarding");
    }
    expect(screen.queryByRole("alertdialog")).toBeNull();
    const expected = answers({ status });
    await h.savedAs(expected);
    await waitFor(() => expect(location.history).toEqual(["/onboarding", "/"]));
    expect(h.writes).toEqual([expected]);
    // A fresh mount reads the saved answers via HTTP, not a copied hook mock.
    unmount();
    h.client.removeQueries({ queryKey: prefsKey });
    await mount();
    expect(h.client.getQueryData(prefsKey)).toEqual(expected);
    expect(checked("experience", "new")).toBe(false);
    expect(h.writes).toEqual([expected]);
  });
});
