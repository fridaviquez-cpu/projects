import { Router, type IRouter } from "express";
import { GetBudgetSummaryQueryParams, SetBudgetLimitBody } from "@workspace/api-zod";
import { editWorkspace, publicWorkspace, requireWorkspace } from "../../lib/portfolio-store";
import { budgetSummary } from "../../lib/portfolio-summary";

const router: IRouter = Router();
router.get("/budget", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const { month } = GetBudgetSummaryQueryParams.parse(req.query);
  res.json(budgetSummary(workspace.data, month));
});
router.put("/budget/limit", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const input = SetBudgetLimitBody.parse(req.body);
  const { workspace: updated } = await editWorkspace(workspace.id, (data) => {
    data.budgetLimits[input.month] = input.limitCents;
  });
  res.json(publicWorkspace(updated));
});
export default router;
