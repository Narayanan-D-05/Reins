import { Router } from "express";
import { z } from "zod";
import { zeroAddress } from "viem";
import { addressSchema, bigintStringSchema, webAuthnAssertionSchema } from "../validation/schemas.js";
import { asyncHandler, serializeBigInts } from "../asyncHandler.js";
import { buildPullReinsRequest, encodePullReinsTx } from "../../services/pullReinsService.js";

export const pullReinsRouter = Router();

const buildRequestSchema = z.object({
  account: addressSchema,
  agentKey: addressSchema.optional(), // omit to revoke every agent
});

pullReinsRouter.post(
  "/pull-reins/build-request",
  asyncHandler(async (req, res) => {
    const { account, agentKey } = buildRequestSchema.parse(req.body);
    const result = await buildPullReinsRequest(account, agentKey ?? zeroAddress);
    res.json(serializeBigInts(result));
  })
);

const encodeTxSchema = z.object({
  account: addressSchema,
  agentKey: addressSchema.optional(),
  nonce: bigintStringSchema,
  validBeforeBlock: bigintStringSchema,
  assertion: webAuthnAssertionSchema,
});

pullReinsRouter.post(
  "/pull-reins/encode-tx",
  asyncHandler(async (req, res) => {
    const { account, agentKey, nonce, validBeforeBlock, assertion } = encodeTxSchema.parse(req.body);
    const data = encodePullReinsTx(agentKey ?? zeroAddress, nonce, validBeforeBlock, assertion);
    res.json({ to: account, data });
  })
);
