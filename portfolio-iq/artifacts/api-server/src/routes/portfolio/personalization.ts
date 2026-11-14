import { Router, type IRouter } from "express";
import {
  GetPersonalizationResponse, SavePersonalizationBody, SavePersonalizationResponse,
  type Preferences,
} from "@workspace/api-zod";
import { editWorkspace, HttpError, requireWorkspace } from "../../lib/portfolio-store";

const router: IRouter = Router();

function emptyPreferences(): Preferences {
  return {
    status: "new", experience: null, objectives: [], brokerages: [],
    accountTypes: [], goals: [], horizon: null, learning: [],
  };
}

router.get("/workspace/personalization", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  res.json(GetPersonalizationResponse.parse(workspace.data.personalization ?? emptyPreferences()));
});

router.put("/workspace/personalization", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const input = SavePersonalizationBody.parse(req.body);
  // Validate duplicates explicitly as not all code generators enforce uniqueItems.
  for (const key of ["objectives", "brokerages", "accountTypes", "goals", "learning"] as const) {
    if (new Set(input[key]).size !== input[key].length) {
      throw new HttpError(400, "Choose each answer only once.");
    }
  }
  if (input.brokerages.includes("None") && input.brokerages.length > 1) {
    throw new HttpError(400, 'Choose either "Not investing yet" or your brokerages, not both.');
  }
  const { result } = await editWorkspace(workspace.id, (data) => {
    // Skipping must never commit a partly answered draft or erase earlier saved answers.
    const saved: Preferences = input.status === "skipped"
      ? { ...(data.personalization ?? emptyPreferences()), status: "skipped" }
      : input;
    data.personalization = saved;
    // Retain compatibility with existing overview/assistant educational experience.
    if (input.status !== "skipped") {
      data.experience = saved.experience === "experienced" ? "Advanced"
        : saved.experience === "regular" ? "Intermediate" : "Beginner";
    }
    return saved;
  });
  res.json(SavePersonalizationResponse.parse(result));
});

export default router;
