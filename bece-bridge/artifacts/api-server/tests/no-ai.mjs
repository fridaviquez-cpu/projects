// Assessment tests must never initialize an AI client or make billable calls.
let response;
export function setTestCompletion(handler) { response = handler; }
export const openai = {
  chat: { completions: { create(...args) {
    if (!response) throw new Error("Unexpected AI call in regression tests");
    return response(...args);
  } } },
};
