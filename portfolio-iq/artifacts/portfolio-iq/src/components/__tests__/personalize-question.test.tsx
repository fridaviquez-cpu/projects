import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Preferences } from "@workspace/api-client-react";
import { EMPTY_PREFS, QUESTIONS, type Question } from "@/lib/personalize";
import { PreferenceQuestion } from "../preference-question";

afterEach(cleanup);

// Exercise the actual controlled component, including rerenders after a click.
// No preferences hook, guest server, or AI request is needed.
function mount(key: Question["key"], initial: Partial<Preferences> = {}) {
  const changed = vi.fn<(p: Preferences) => void>();
  function Harness() {
    const [value, setValue] = useState<Preferences>({ ...structuredClone(EMPTY_PREFS), ...initial });
    return <PreferenceQuestion q={QUESTIONS.find((q) => q.key === key)!} value={value}
      onChange={(next) => { changed(next); setValue(next); }} />;
  }
  render(<Harness />);
  return changed;
}

function click(key: Question["key"], value: string) {
  fireEvent.click(screen.getByTestId(`input-${key}-${value}`));
}

function selected(key: Question["key"]) {
  return screen.getAllByRole<HTMLInputElement>(key === "experience" || key === "horizon" ? "radio" : "checkbox")
    .filter((input) => input.checked).map((input) => input.value);
}

describe("PreferenceQuestion selections", () => {
  it.each(["experience", "horizon"] as const)("%s can be selected, replaced, toggled off, and explicitly cleared", (key) => {
    const [first, second] = QUESTIONS.find((q) => q.key === key)!.options;
    const changed = mount(key, { goals: ["Learning"] });
    expect(selected(key)).toEqual([]);
    expect(screen.queryByRole("button", { name: "Clear this answer" })).toBeNull();
    click(key, first.value);
    expect(selected(key)).toEqual([first.value]);
    click(key, second.value);
    expect(selected(key)).toEqual([second.value]);
    click(key, second.value);
    expect(selected(key)).toEqual([]);
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ [key]: null, goals: ["Learning"] }));
    click(key, first.value);
    fireEvent.click(screen.getByRole("button", { name: "Clear this answer" }));
    expect(selected(key)).toEqual([]);
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ [key]: null, goals: ["Learning"] }));
    expect(screen.queryByRole("button", { name: "Clear this answer" })).toBeNull();
  });

  it("makes None exclusive in both directions and lets it be deselected", () => {
    const changed = mount("brokerages", { experience: "regular" });
    click("brokerages", "Fidelity");
    click("brokerages", "Vanguard");
    expect(selected("brokerages")).toEqual(["Fidelity", "Vanguard"]);
    click("brokerages", "None");
    expect(selected("brokerages")).toEqual(["None"]);
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ brokerages: ["None"], experience: "regular" }));
    click("brokerages", "None");
    expect(selected("brokerages")).toEqual([]);
    click("brokerages", "None");
    click("brokerages", "Robinhood");
    expect(selected("brokerages")).toEqual(["Robinhood"]);
    click("brokerages", "Other");
    expect(selected("brokerages")).toEqual(["Robinhood", "Other"]);
    click("brokerages", "Robinhood");
    expect(selected("brokerages")).toEqual(["Other"]);
    click("brokerages", "None");
    expect(selected("brokerages")).toEqual(["None"]);
    click("brokerages", "Other");
    expect(selected("brokerages")).toEqual(["Other"]);
  });

  it.each(["Fidelity", "Vanguard", "Robinhood", "Charles Schwab", "Other"])("%s replaces None and is replaced by None", (brokerage) => {
    const changed = mount("brokerages", { brokerages: ["None"], goals: ["Retirement"] });
    click("brokerages", brokerage);
    expect(selected("brokerages")).toEqual([brokerage]);
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ brokerages: [brokerage], goals: ["Retirement"] }));
    click("brokerages", "None");
    expect(selected("brokerages")).toEqual(["None"]);
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ brokerages: ["None"], goals: ["Retirement"] }));
  });

  it.each(["objectives", "accountTypes", "goals", "learning"] as const)("%s keeps multiple choices and removes only the clicked choice", (key) => {
    const [first, second] = QUESTIONS.find((q) => q.key === key)!.options;
    const changed = mount(key, { horizon: "over-10" });
    click(key, first.value);
    click(key, second.value);
    expect(selected(key)).toEqual([first.value, second.value]);
    click(key, first.value);
    expect(selected(key)).toEqual([second.value]);
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ [key]: [second.value], horizon: "over-10" }));
    expect(screen.queryByRole("button", { name: "Clear this answer" })).toBeNull();
  });
});
