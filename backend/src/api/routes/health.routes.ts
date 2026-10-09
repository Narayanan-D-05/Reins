import { Router } from "express";
import { publicClient } from "../../chain/client.js";
import { addresses } from "../../chain/addresses.js";
import { asyncHandler, serializeBigInts } from "../asyncHandler.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

healthRouter.get(
  "/chain/info",
  asyncHandler(async (_req, res) => {
    const [chainId, blockNumber] = await Promise.all([
      publicClient.getChainId(),
      publicClient.getBlockNumber(),
    ]);
    res.json(serializeBigInts({ chainId, blockNumber, addresses }));
  })
);
