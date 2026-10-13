import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { ZodError } from "zod";
import { BaseError as ViemBaseError } from "viem";
import { logger } from "../config/logger.js";
import { DashboardNotConfiguredError } from "../services/dashboardService.js";
import { healthRouter } from "./routes/health.routes.js";
import { policyRouter } from "./routes/policy.routes.js";
import { pullReinsRouter } from "./routes/pullReins.routes.js";
import { attestationRouter } from "./routes/attestation.routes.js";
import { settlementRouter } from "./routes/settlement.routes.js";
import { identityRouter } from "./routes/identity.routes.js";
import { accountRouter } from "./routes/account.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.use(healthRouter);
  app.use(policyRouter);
  app.use(pullReinsRouter);
  app.use(attestationRouter);
  app.use(settlementRouter);
  app.use(identityRouter);
  app.use(accountRouter);
  app.use(dashboardRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Invalid request", issues: err.issues });
      return;
    }
    if (err instanceof DashboardNotConfiguredError) {
      res.status(503).json({ error: err.message });
      return;
    }
    if (err instanceof ViemBaseError) {
      res.status(502).json({ error: "Chain call failed", message: err.shortMessage ?? err.message });
      return;
    }
    logger.error({ err }, "Unhandled error");
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);

  return app;
}
