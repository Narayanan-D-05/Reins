import { z } from "zod";

export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 20-byte address")
  .transform((v) => v as `0x${string}`);

export const hexSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]*$/, "must be a 0x-prefixed hex string")
  .transform((v) => v as `0x${string}`);

export const bigintStringSchema = z
  .union([z.string(), z.number()])
  .transform((v) => BigInt(v));

export const policyParamsSchema = z.object({
  perPaymentCap: bigintStringSchema,
  dailyCap: bigintStringSchema,
  expiry: bigintStringSchema,
  minSettlementAmount: bigintStringSchema,
  minDistinctPayers: z.number().int().nonnegative().max(65535),
  probationCap: bigintStringSchema,
  externalOracle: addressSchema,
  categories: z.array(hexSchema),
});

export const webAuthnAssertionSchema = z.object({
  authenticatorData: hexSchema,
  clientDataJSON: z.string(),
  challengeIndex: bigintStringSchema,
  typeIndex: bigintStringSchema,
  r: bigintStringSchema,
  s: bigintStringSchema,
});
