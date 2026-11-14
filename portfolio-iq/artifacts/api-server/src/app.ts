import express, { type Express, type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { HttpError } from "./lib/portfolio-store";

const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((req, res, next) => {
  // Only same-origin browsers may mutate private workspaces. No permissive CORS.
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    const hosts = [req.get("host"), req.get("x-forwarded-host")].filter(Boolean);
    let validOrigin = true;
    try { if (origin) validOrigin = hosts.includes(new URL(origin).host); } catch { validOrigin = false; }
    if (!validOrigin || req.get("sec-fetch-site") === "cross-site") {
      res.status(403).json({ error: "Cross-site requests are not allowed." });
      return;
    }
    if (!req.is("application/json") && Number(req.get("content-length") ?? 0) > 0) {
      res.status(415).json({ error: "Send data as application/json." });
      return;
    }
  }
  next();
});
app.use(cookieParser());
const standardJson = express.json({ limit: "100kb" });
app.use((req, res, next) => {
  // This one route accepts a size-limited transient image after its own guest
  // and rate-limit checks. All ordinary data requests keep the small limit.
  if (req.method === "POST" && req.path === "/api/image-imports/extract") { next(); return; }
  standardJson(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    res.status(400).json({ error: issue ? `${issue.path.join(".") || "Input"}: ${issue.message}` : "Invalid input." });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON." });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "The request is too large." });
    return;
  }
  req.log.error({ errorType: err instanceof Error ? err.name : "UnknownError" }, "PortfolioIQ request failed");
  res.status(500).json({ error: "Something went wrong. Your changes may not have been saved. Please retry." });
};
app.use(errorHandler);

export default app;
