import { encodeFunctionData, zeroAddress, type Address, type Hex } from "viem";
import { publicClient } from "../chain/client.js";
import { ReinsAccountAbi } from "../chain/abiIndex.js";
import { buildPullReinsChallenge } from "../domain/mandate.js";
import { getOwnerActionNonce } from "./policyService.js";
import type { WebAuthnAssertion } from "../domain/types.js";

/// `agentKey` = zeroAddress means "revoke every agent under this account".
export async function buildPullReinsRequest(
  account: Address,
  agentKey: Address = zeroAddress,
  validBlockWindow = 100n
): Promise<{ challenge: Hex; nonce: bigint; validBeforeBlock: bigint }> {
  const [nonce, currentBlock] = await Promise.all([
    getOwnerActionNonce(account),
    publicClient.getBlockNumber(),
  ]);
  const validBeforeBlock = currentBlock + validBlockWindow;
  const challenge = buildPullReinsChallenge(account, agentKey, nonce, validBeforeBlock);
  return { challenge, nonce, validBeforeBlock };
}

export function encodePullReinsTx(
  agentKey: Address,
  nonce: bigint,
  validBeforeBlock: bigint,
  assertion: WebAuthnAssertion
): Hex {
  return encodeFunctionData({
    abi: ReinsAccountAbi,
    functionName: "pullReins",
    args: [agentKey, nonce, validBeforeBlock, assertion],
  });
}
