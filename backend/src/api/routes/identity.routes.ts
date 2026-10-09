import { Router } from "express";
import { z } from "zod";
import { bigintStringSchema, hexSchema } from "../validation/schemas.js";
import { asyncHandler, serializeBigInts } from "../asyncHandler.js";
import {
  encodeRegisterAgentTx,
  encodeSetMetadataTx,
  getAgentWallet,
  getAgentMetadata,
} from "../../services/identityService.js";
import { addresses } from "../../chain/addresses.js";

export const identityRouter = Router();

const registerSchema = z.object({ agentURI: z.string().url() });

/// Calldata for the agent's own key to call ERC-8004's register() directly
/// — Reins never relays this itself (src/factory/ReinsAccountFactory.sol).
identityRouter.post(
  "/identity/register-tx",
  asyncHandler(async (req, res) => {
    const { agentURI } = registerSchema.parse(req.body);
    const data = encodeRegisterAgentTx(agentURI);
    res.json({ to: addresses.erc8004IdentityRegistry, data });
  })
);

const setMetadataSchema = z.object({
  agentId: bigintStringSchema,
  metadataKey: z.string().min(1),
  metadataValue: hexSchema,
});

identityRouter.post(
  "/identity/set-metadata-tx",
  asyncHandler(async (req, res) => {
    const { agentId, metadataKey, metadataValue } = setMetadataSchema.parse(req.body);
    const data = encodeSetMetadataTx(agentId, metadataKey, metadataValue);
    res.json({ to: addresses.erc8004IdentityRegistry, data });
  })
);

const agentIdParamsSchema = z.object({ agentId: z.string().regex(/^\d+$/) });

identityRouter.get(
  "/identity/:agentId/wallet",
  asyncHandler(async (req, res) => {
    const { agentId } = agentIdParamsSchema.parse(req.params);
    const wallet = await getAgentWallet(BigInt(agentId));
    res.json({ wallet });
  })
);

const metadataQuerySchema = z.object({ key: z.string().min(1) });

identityRouter.get(
  "/identity/:agentId/metadata",
  asyncHandler(async (req, res) => {
    const { agentId } = agentIdParamsSchema.parse(req.params);
    const { key } = metadataQuerySchema.parse(req.query);
    const value = await getAgentMetadata(BigInt(agentId), key);
    res.json(serializeBigInts({ value }));
  })
);
