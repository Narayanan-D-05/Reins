import { encodeAbiParameters, keccak256, encodePacked, type Address, type Hex } from "viem";
import type { PolicyParams } from "./types.js";

/// Mirrors ReinsAccount.computeMandateDigest exactly. Must stay
/// byte-for-byte identical to the Solidity implementation — if this drifts,
/// every signature built from it will fail on-chain verification.
export function computeMandateDigest(account: Address, agentKey: Address, params: PolicyParams): Hex {
  const categoriesHash = keccak256(encodePacked(["bytes32[]"], [params.categories]));

  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint16" },
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
      ],
      [
        account,
        agentKey,
        params.perPaymentCap,
        params.dailyCap,
        params.expiry,
        params.minSettlementAmount,
        params.minDistinctPayers,
        params.probationCap,
        params.externalOracle,
        categoriesHash,
      ]
    )
  );
}

/// Mirrors the challenge built inside ReinsAccount.setPolicy.
export function buildSetPolicyChallenge(
  account: Address,
  mandateDigest: Hex,
  nonce: bigint,
  validBeforeBlock: bigint
): Hex {
  return encodeAbiParameters(
    [{ type: "address" }, { type: "string" }, { type: "bytes32" }, { type: "uint256" }, { type: "uint256" }],
    [account, "SET_POLICY", mandateDigest, nonce, validBeforeBlock]
  );
}

/// Mirrors the challenge built inside ReinsAccount.pullReins.
export function buildPullReinsChallenge(
  account: Address,
  agentKey: Address,
  nonce: bigint,
  validBeforeBlock: bigint
): Hex {
  return encodeAbiParameters(
    [{ type: "address" }, { type: "string" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }],
    [account, "PULL_REINS", agentKey, nonce, validBeforeBlock]
  );
}
