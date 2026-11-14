import { Router, type IRouter } from "express";
import { GetLearningTopicsResponse, UpdateLearningProgressBody, UpdateLearningProgressParams, UpdateLearningProgressResponse } from "@workspace/api-zod";
import { editWorkspace, HttpError, requireWorkspace } from "../../lib/portfolio-store";
import { learningCatalog, publicTopic } from "../../lib/learning-catalog";

const router: IRouter = Router();
router.get("/learning", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  res.json(GetLearningTopicsResponse.parse(learningCatalog.map((topic) => publicTopic(topic, workspace.data.progress[topic.id]))));
});
router.put("/learning/:id", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const { id } = UpdateLearningProgressParams.parse(req.params);
  const input = UpdateLearningProgressBody.parse(req.body);
  const topic = learningCatalog.find((t) => t.id === id);
  if (!topic) throw new HttpError(404, "Learning topic not found.");
  if (input.answer === undefined && input.bookmarked === undefined) throw new HttpError(400, "Choose an answer or change the bookmark.");
  if (input.answer !== undefined && input.answer !== topic.correctIndex) throw new HttpError(400, "Not quite. Read the explanation and try another answer.");
  const { result } = await editWorkspace(workspace.id, (data) => {
    const progress = data.progress[id] ?? { completed: false, bookmarked: false };
    if (input.answer !== undefined) progress.completed = true;
    if (input.bookmarked !== undefined) progress.bookmarked = input.bookmarked;
    data.progress[id] = progress;
    return publicTopic(topic, progress);
  });
  res.json(UpdateLearningProgressResponse.parse(result));
});
export default router;
