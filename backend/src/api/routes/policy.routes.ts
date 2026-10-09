import { Router } from "express";
import { z } from "zod";
import { addressSchema, bigintStringSchema, policyParamsSchema, webAuthnAssertionSchema } from "../validation/schemas.js";
import { asyncHandler, serializeBigInts } from "../asyncHandler.js";
import { buildSetPolicyRequest, encodeSetPolicyTx, getPolicy } from "../../services/policyService.js";
import { addresses } from "../../chain/addresses.js";

export const policyRouter = Router();

const buildRequestSchema = z.object({
  account: addressSchema,
  agentKey: addressSchema,
  params: policyParamsSchema,
});

/// Returns the mandate digest + exact challenge bytes for the owner's
/// WebAuthn ceremony. The frontend passes `challenge` to
/// `navigator.credentials.get()` and sends the resulting assertion to
/// POST /policy/encode-tx.
policyRouter.post(
  "/policy/build-request",
  asyncHandler(async (req, res) => {
    const { account, agentKey, params } = buildRequestSchema.parse(req.body);
    const result = await buildSetPolicyRequest(account, agentKey, params);
    res.json(serializeBigInts(result));
  })
);

const encodeTxSchema = z.object({
  account: addressSchema,
  agentKey: addressSchema,
  params: policyParamsSchema,
  nonce: bigintStringSchema,
  validBeforeBlock: bigintStringSchema,
  assertion: webAuthnAssertionSchema,
});

/// Returns raw calldata for setPolicy. The backend never broadcasts this —
/// the owner's own wallet (or a relayer they choose) sends it, since the
/// backend holds no signing key.
policyRouter.post(
  "/policy/encode-tx",
  asyncHandler(async (req, res) => {
    const { account, agentKey, params, nonce, validBeforeBlock, assertion } = encodeTxSchema.parse(req.body);
    const data = encodeSetPolicyTx(agentKey, params, nonce, validBeforeBlock, assertion);
    res.json({ to: account, data });
  })
);

const getPolicySchema = z.object({
  account: addressSchema,
  agentKey: addressSchema,
});

policyRouter.get(
  "/policy/:account/:agentKey",
  asyncHandler(async (req, res) => {
    const { account, agentKey } = getPolicySchema.parse(req.params);
    const policy = await getPolicy(account, agentKey);
    res.json(serializeBigInts(policy));
  })
);

policyRouter.get("/policy/addresses", (_req, res) => {
  res.json(addresses);
});
