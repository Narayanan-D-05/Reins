import type { Address, Hex } from "viem";

/// Mirrors ReinsAccount.PolicyParams exactly — field order matters because
/// it's abi-encoded into the mandate digest the owner signs.
export interface PolicyParams {
  perPaymentCap: bigint;
  dailyCap: bigint;
  expiry: bigint;
  minSettlementAmount: bigint;
  minDistinctPayers: number;
  probationCap: bigint;
  externalOracle: Address;
  categories: Hex[]; // bytes32[]
}

/// Mirrors WebAuthnP256.Assertion exactly.
export interface WebAuthnAssertion {
  authenticatorData: Hex;
  clientDataJSON: string;
  challengeIndex: bigint;
  typeIndex: bigint;
  r: bigint;
  s: bigint;
}

export interface SignedOwnerAction {
  nonce: bigint;
  validBeforeBlock: bigint;
  assertion: WebAuthnAssertion;
}
