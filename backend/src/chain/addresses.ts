import { env } from "../config/env.js";
import type { Address } from "viem";

export const addresses: {
  receiptBook: Address;
  attestor: Address;
  settlementGate: Address;
  factory: Address;
  erc8004IdentityRegistry: Address;
} = {
  receiptBook: env.RECEIPT_BOOK_ADDRESS as Address,
  attestor: env.ATTESTOR_ADDRESS as Address,
  settlementGate: env.SETTLEMENT_GATE_ADDRESS as Address,
  factory: env.FACTORY_ADDRESS as Address,
  erc8004IdentityRegistry: env.ERC8004_IDENTITY_REGISTRY_ADDRESS as Address,
};
