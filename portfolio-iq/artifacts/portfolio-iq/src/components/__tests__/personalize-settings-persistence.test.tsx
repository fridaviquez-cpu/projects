import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonalizationSettings } from "../personalization-settings";
import { answers, checked, click, disabled, persistenceHarness, prefsKey, workspaceKey } from "@/test/personalization-harness";

const h = persistenceHarness();

async function mount() {
  const dirty = vi.fn<(value: boolean) => void>();
  const view = h.mount(<PersonalizationSettings onDirtyChange={dirty} />);
  await h.loaded();
  await screen.findByTestId("section-personalization");
  return { ...view, dirty };
}

describe("Settings preferences persistence", () => {
  it("loads no editable defaults on HTTP failure and retries the real query", async () => {
    h.seed(answers({ experience: "regular", goals: ["Retirement"], status: "completed" }));
    h.failLoad();
    h.mount(<PersonalizationSettings onDirtyChange={vi.fn()} />);
    expect(screen.getByLabelText("Loading setup answers").getAttribute("aria-busy")).toBe("true");
    expect((await screen.findByRole("alert")).textContent).toContain("Your setup answers didn't load");
    expect(screen.queryByTestId("question-experience")).toBeNull();
    expect(h.client.getQueryData(prefsKey)).toBeUndefined();
    expect(h.writes).toEqual([]);
    h.failLoad(false);
    click("button-retry-personalization");
    await h.loaded();
    expect(await screen.findByTestId("section-personalization")).toBeTruthy();
    expect(checked("experience", "regular")).toBe(true);
    expect(checked("goals", "Retirement")).toBe(true);
  });

  it("keeps an unsaved draft through background refresh and resets to the newest saved answers only after confirmation", async () => {
    h.seed(answers({ experience: "basics", goals: ["Learning"], status: "completed" }));
    const { dirty } = await mount();
    click("input-experience-experienced");
    click("input-goals-Business");
    const refreshed = answers({ experience: "regular", goals: ["Retirement"], horizon: "5-10", status: "completed" });
    await h.refetch(refreshed);
    expect(checked("experience", "experienced")).toBe(true);
    expect(checked("goals", "Business")).toBe(true);
    expect(checked("goals", "Learning")).toBe(true);
    expect(checked("horizon", "5-10")).toBe(false);
    expect(screen.getByTestId("text-personalization-status").textContent).toContain("Retirement");
    expect(dirty).toHaveBeenLastCalledWith(true);
    click("button-reset-personalization");
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(checked("experience", "experienced")).toBe(true);
    expect(dirty).toHaveBeenLastCalledWith(true);
    click("button-reset-personalization");
    click("button-confirm-reset-personalization");
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
    expect(checked("experience", "regular")).toBe(true);
    expect(checked("goals", "Retirement")).toBe(true);
    expect(checked("goals", "Business")).toBe(false);
    expect(checked("horizon", "5-10")).toBe(true);
    expect(disabled("button-save-personalization")).toBe(true);
    expect(h.writes).toEqual([]);
    expect(h.client.getQueryState(workspaceKey)?.isInvalidated).toBe(false);
  });

  it("retains edits and saved status after a failed save, then uses the server response and clears dirty state on retry", async () => {
    const initial = answers({ experience: "basics", status: "skipped" });
    h.seed(initial);
    const { dirty } = await mount();
    click("input-experience-regular");
    h.failSave();
    click("button-save-personalization");
    expect((await screen.findByTestId("status-personalization-error")).textContent).toContain("Not saved:");
    expect(checked("experience", "regular")).toBe(true);
    expect(dirty).toHaveBeenLastCalledWith(true);
    expect(h.client.getQueryData(prefsKey)).toEqual(initial);
    expect(h.saved).toEqual(initial);
    expect(screen.getByTestId("text-personalization-status").textContent).toContain("Skipped for now");
    expect(disabled("button-save-personalization")).toBe(false);
    expect(h.client.getQueryState(workspaceKey)?.isInvalidated).toBe(false);

    h.failSave(false);
    // A distinct server response proves that cache/draft use the response,
    // rather than merely copying the submitted object.
    const returned = answers({ experience: "regular", goals: ["Learning"], status: "completed" });
    h.replyWith(returned);
    const release = h.pauseSave();
    click("button-save-personalization");
    await waitFor(() => expect(h.writes).toHaveLength(2));
    expect(disabled("button-save-personalization")).toBe(true);
    expect(disabled("button-clear-personalization")).toBe(true);
    expect(screen.getByTestId("question-experience").hasAttribute("disabled")).toBe(true);
    click("button-save-personalization");
    expect(h.writes).toHaveLength(2);
    await act(async () => { release(); });
    await h.savedAs(returned);
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
    expect(checked("goals", "Learning")).toBe(true);
    expect(screen.getByTestId("text-personalization-status").textContent).toContain("Set up");
    expect(screen.queryByTestId("status-personalization-error")).toBeNull();
    expect(disabled("button-save-personalization")).toBe(true);
    expect(h.writes).toEqual([1, 2].map(() => answers({ experience: "regular", status: "completed" })));
  });

  it("cancels clear-all without changes, clears only the draft on confirmation, and explicitly saves completed-empty setup", async () => {
    const initial = answers({
      experience: "regular", objectives: ["learn"], brokerages: ["Fidelity"],
      accountTypes: ["Roth IRA"], goals: ["Retirement"], horizon: "over-10",
      learning: ["simple"], status: "skipped",
    });
    h.seed(initial);
    const { dirty, unmount } = await mount();
    click("input-goals-Business");
    click("button-clear-personalization");
    expect((await screen.findByRole("alertdialog")).textContent).toContain("Financial records will not change");
    fireEvent.click(screen.getByRole("button", { name: "Keep answers" }));
    expect(checked("goals", "Business")).toBe(true);
    expect(checked("experience", "regular")).toBe(true);
    expect(h.writes).toEqual([]);
    click("button-clear-personalization");
    click("button-confirm-clear-personalization");
    expect(screen.getAllByRole<HTMLInputElement>("checkbox").some((el) => el.checked)).toBe(false);
    expect(screen.getAllByRole<HTMLInputElement>("radio").some((el) => el.checked)).toBe(false);
    expect(dirty).toHaveBeenLastCalledWith(true);
    expect(h.saved).toEqual(initial);
    expect(h.client.getQueryData(prefsKey)).toEqual(initial);
    expect(h.writes).toEqual([]);
    h.failSave();
    click("button-save-personalization");
    await screen.findByTestId("status-personalization-error");
    expect(screen.getAllByRole<HTMLInputElement>("checkbox").some((el) => el.checked)).toBe(false);
    expect(screen.getAllByRole<HTMLInputElement>("radio").some((el) => el.checked)).toBe(false);
    expect(h.saved).toEqual(initial);
    expect(h.client.getQueryData(prefsKey)).toEqual(initial);
    expect(dirty).toHaveBeenLastCalledWith(true);
    h.failSave(false);
    click("button-save-personalization");
    await h.savedAs(answers({ status: "completed" }));
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
    expect(screen.getByTestId("text-personalization-status").textContent).toBe("No answers selected");
    expect(disabled("button-clear-personalization")).toBe(true);
    expect(h.writes).toEqual([answers({ status: "completed" }), answers({ status: "completed" })]);
    unmount();
    h.client.removeQueries({ queryKey: prefsKey });
    const reopened = await mount();
    expect(screen.getByTestId("text-personalization-status").textContent).toBe("No answers selected");
    expect(reopened.dirty).toHaveBeenLastCalledWith(false);
    expect(disabled("button-save-personalization")).toBe(true);
  });

  it.each([
    ["new", "Not set up yet"], ["skipped", "Skipped for now"], ["completed", "No answers selected"],
  ] as const)("shows %s empty setup distinctly without saving on mount", async (status, label) => {
    h.seed(answers({ status }));
    const { dirty } = await mount();
    expect(screen.getByTestId("text-personalization-status").textContent).toBe(label);
    expect(disabled("button-save-personalization")).toBe(true);
    expect(dirty).toHaveBeenLastCalledWith(false);
    expect(h.writes).toEqual([]);
  });
});
