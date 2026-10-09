import { Router } from "express";
import { z } from "zod";
import { addressSchema, bigintStringSchema } from "../validation/schemas.js";
import { asyncHandler } from "../asyncHandler.js";
import { encodeCreateAccountTx, getAccountsForCreator } from "../../services/accountService.js";
import { addresses } from "../../chain/addresses.js";

export const accountRouter = Router();

const createSchema = z.object({
  ownerPubKeyX: bigintStringSchema,
  ownerPubKeyY: bigintStringSchema,
});

accountRouter.post(
  "/accounts/create-tx",
  asyncHandler(async (req, res) => {
    const { ownerPubKeyX, ownerPubKeyY } = createSchema.parse(req.body);
    const data = encodeCreateAccountTx(ownerPubKeyX, ownerPubKeyY);
    res.json({ to: addresses.factory, data });
  })
);

const creatorParamsSchema = z.object({ creator: addressSchema });

accountRouter.get(
  "/accounts/:creator",
  asyncHandler(async (req, res) => {
    const { creator } = creatorParamsSchema.parse(req.params);
    const accounts = await getAccountsForCreator(creator);
    res.json({ accounts });
  })
);
