import { defineChain } from "viem";
import { env } from "../config/env.js";

// Monad Testnet — chain id 10143, confirmed against docs.monad.xyz.
export const monadTestnet = defineChain({
  id: env.MONAD_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [env.MONAD_RPC_URL] },
  },
});
