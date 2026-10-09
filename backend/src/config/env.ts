import { z } from "zod";
import "dotenv/config";

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 20-byte address");

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  MONAD_RPC_URL: z.string().url(),
  MONAD_CHAIN_ID: z.coerce.number().int().positive().default(10143),

  RECEIPT_BOOK_ADDRESS: addressSchema,
  ATTESTOR_ADDRESS: addressSchema,
  SETTLEMENT_GATE_ADDRESS: addressSchema,
  FACTORY_ADDRESS: addressSchema,

  // Deployed ERC-8004 Identity Registry on Monad Testnet, verified against
  // the registry source (see src/chain/abis.generated.ts). Overridable in
  // case Reins targets a different network later.
  ERC8004_IDENTITY_REGISTRY_ADDRESS: addressSchema.default(
    "0x8004A818BFB912233c491871b3d84c89A494BD9e"
  ),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid or missing environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
