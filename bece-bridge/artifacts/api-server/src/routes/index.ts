import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bridgeRouter from "./bridge";
import authRouter from "./auth";
import materialsRouter from "./materials";
import adminReportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(materialsRouter);
router.use(adminReportsRouter);
router.use(bridgeRouter);

export default router;
