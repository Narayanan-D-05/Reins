import { createPublicClient, http } from "viem";
import { monadTestnet } from "./chain.js";
import { env } from "../config/env.js";

/// Read-only RPC client. The backend never holds a signing key of its own —
/// every state-changing action is signed client-side by the owner's
/// WebAuthn passkey or an agent's Mera-derived key, then broadcast directly.
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(env.MONAD_RPC_URL),
});
