import { Router } from "express";
import { z } from "zod";
import { asyncHandler, serializeBigInts } from "../asyncHandler.js";
import { verifyAttestation } from "../../services/attestationService.js";

export const attestationRouter = Router();

const paramsSchema = z.object({
  attestationId: z.string().regex(/^\d+$/),
});

/// Public attestation verifier (PRD §5.4, §12 SHOULD BUILD). No account,
/// no API key — anyone can check whether an attestation is still valid.
attestationRouter.get(
  "/attestations/:attestationId/verify",
  asyncHandler(async (req, res) => {
    const { attestationId } = paramsSchema.parse(req.params);
    const result = await verifyAttestation(BigInt(attestationId));
    res.json(serializeBigInts(result));
  })
);
