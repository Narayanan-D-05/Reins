import type { Address, Hex } from "viem";
import { publicClient } from "../chain/client.js";
import { AttestorAbi } from "../chain/abiIndex.js";
import { addresses } from "../chain/addresses.js";

export interface AttestationVerifyResult {
  valid: boolean;
  reason: string;
  attestation: {
    account: Address;
    agentKey: Address;
    mandateDigest: Hex;
    receiptId: bigint;
    issuedAtBlock: bigint;
  };
}

/// The public attestation verifier (PRD §5.4, §12 SHOULD BUILD). Anyone can
/// call this with no account and no relationship to Reins — it re-checks
/// live chain state through the issuing ReinsAccount, not a frozen flag.
export async function verifyAttestation(attestationId: bigint): Promise<AttestationVerifyResult> {
  const [valid, reason, attestation] = (await publicClient.readContract({
    address: addresses.attestor,
    abi: AttestorAbi,
    functionName: "verify",
    args: [attestationId],
  })) as [boolean, string, AttestationVerifyResult["attestation"]];

  return { valid, reason, attestation };
}
