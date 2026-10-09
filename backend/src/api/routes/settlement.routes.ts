import { Router } from "express";
import { z } from "zod";
import { addressSchema, bigintStringSchema } from "../validation/schemas.js";
import { asyncHandler, serializeBigInts } from "../asyncHandler.js";
import { getSettlementScore, previewSettlementGate } from "../../services/settlementService.js";
import { zeroAddress } from "viem";

export const settlementRouter = Router();

const scoreParamsSchema = z.object({ payee: addressSchema });

settlementRouter.get(
  "/settlement/:payee/score",
  asyncHandler(async (req, res) => {
    const { payee } = scoreParamsSchema.parse(req.params);
    const score = await getSettlementScore(payee);
    res.json(serializeBigInts(score));
  })
);

const previewSchema = z.object({
  payee: addressSchema,
  amount: bigintStringSchema,
  minSettlementAmount: bigintStringSchema,
  minDistinctPayers: z.number().int().nonnegative().max(65535),
  probationCap: bigintStringSchema,
  externalOracle: addressSchema.optional(),
});

settlementRouter.post(
  "/settlement/preview",
  asyncHandler(async (req, res) => {
    const body = previewSchema.parse(req.body);
    const result = await previewSettlementGate({
      ...body,
      externalOracle: body.externalOracle ?? zeroAddress,
    });
    res.json(result);
  })
);
