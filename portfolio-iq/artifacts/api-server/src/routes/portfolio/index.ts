import { Router, type IRouter } from "express";
import workspace from "./workspace";
import collections from "./collections";
import budget from "./budget";
import learning from "./learning";
import assistant from "./assistant";
import imageImports from "./image-imports";
import personalization from "./personalization";

const router: IRouter = Router();
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
router.use(workspace, personalization, collections, budget, learning, assistant, imageImports);
export default router;
