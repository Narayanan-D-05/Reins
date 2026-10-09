import { encodeFunctionData, type Address, type Hex } from "viem";
import { publicClient } from "../chain/client.js";
import { ReinsAccountAbi } from "../chain/abiIndex.js";
import { computeMandateDigest, buildSetPolicyChallenge } from "../domain/mandate.js";
import type { PolicyParams, WebAuthnAssertion } from "../domain/types.js";

export async function getOwnerActionNonce(account: Address): Promise<bigint> {
  return publicClient.readContract({
    address: account,
    abi: ReinsAccountAbi,
    functionName: "ownerActionNonce",
  }) as Promise<bigint>;
}

/// Builds everything a frontend needs to run the owner's WebAuthn ceremony
/// for a setPolicy call: the mandate digest and the exact challenge bytes
/// to pass as `options.challenge` to `navigator.credentials.get()`.
export async function buildSetPolicyRequest(
  account: Address,
  agentKey: Address,
  params: PolicyParams,
  validBlockWindow = 100n
): Promise<{ mandateDigest: Hex; challenge: Hex; nonce: bigint; validBeforeBlock: bigint }> {
  const [nonce, currentBlock] = await Promise.all([
    getOwnerActionNonce(account),
    publicClient.getBlockNumber(),
  ]);
  const validBeforeBlock = currentBlock + validBlockWindow;
  const mandateDigest = computeMandateDigest(account, agentKey, params);
  const challenge = buildSetPolicyChallenge(account, mandateDigest, nonce, validBeforeBlock);
  return { mandateDigest, challenge, nonce, validBeforeBlock };
}

/// Returns the raw calldata for setPolicy — the backend never broadcasts
/// this itself; the owner's own funded wallet (or a relayer they choose)
/// sends it.
export function encodeSetPolicyTx(
  agentKey: Address,
  params: PolicyParams,
  nonce: bigint,
  validBeforeBlock: bigint,
  assertion: WebAuthnAssertion
): Hex {
  return encodeFunctionData({
    abi: ReinsAccountAbi,
    functionName: "setPolicy",
    args: [agentKey, params, nonce, validBeforeBlock, assertion],
  });
}

export async function getPolicy(account: Address, agentKey: Address) {
  const [policy, categories] = await Promise.all([
    publicClient.readContract({
      address: account,
      abi: ReinsAccountAbi,
      functionName: "policies",
      args: [agentKey],
    }),
    publicClient.readContract({
      address: account,
      abi: ReinsAccountAbi,
      functionName: "getAllowedCategories",
      args: [agentKey],
    }),
  ]);

  const [
    exists,
    paused,
    perPaymentCap,
    dailyCap,
    spentToday,
    currentDay,
    expiry,
    minSettlementAmount,
    minDistinctPayers,
    probationCap,
    externalOracle,
    mandateDigest,
  ] = policy as [boolean, boolean, bigint, bigint, bigint, bigint, bigint, bigint, number, bigint, Address, Hex];

  return {
    exists,
    paused,
    perPaymentCap,
    dailyCap,
    spentToday,
    currentDay,
    expiry,
    minSettlementAmount,
    minDistinctPayers,
    probationCap,
    externalOracle,
    mandateDigest,
    categories,
  };
}
