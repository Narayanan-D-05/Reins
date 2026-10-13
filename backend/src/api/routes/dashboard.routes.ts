import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../asyncHandler.js";
import { getDashboardFeed, getAtRiskMeter } from "../../services/dashboardService.js";

export const dashboardRouter = Router();

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/// Live feed across every Reins account (PRD §7, §12 MUST BUILD), backed
/// by the Envio indexer rather than raw RPC polling.
dashboardRouter.get(
  "/dashboard/feed",
  asyncHandler(async (req, res) => {
    const { limit } = feedQuerySchema.parse(req.query);
    const feed = await getDashboardFeed(limit);
    res.json({ items: feed });
  })
);

/// At-risk meter: what fraction of attempted payments are being blocked,
/// and why (PRD §7, §12 MUST BUILD).
dashboardRouter.get(
  "/dashboard/at-risk-meter",
  asyncHandler(async (_req, res) => {
    const meter = await getAtRiskMeter();
    res.json(meter);
  })
);
