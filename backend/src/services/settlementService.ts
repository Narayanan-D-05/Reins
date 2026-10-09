import type { Address } from "viem";
import { publicClient } from "../chain/client.js";
import { ReceiptBookAbi, SettlementGateAbi } from "../chain/abiIndex.js";
import { addresses } from "../chain/addresses.js";

/// Tier 1 native settlement score (PRD §6.2) — public, on-chain, anyone can
/// recompute it. No address rates or votes here; these numbers are purely
/// derived from cleared ReceiptBook history.
export async function getSettlementScore(payee: Address): Promise<{ totalReceived: bigint; distinctPayers: bigint }> {
  const [totalReceived, distinctPayers] = (await publicClient.readContract({
    address: addresses.receiptBook,
    abi: ReceiptBookAbi,
    functionName: "getPayeeStats",
    args: [payee],
  })) as [bigint, bigint];

  return { totalReceived, distinctPayers };
}

/// Previews what the Settlement Gate would decide for a hypothetical
/// payment, without sending a transaction (a plain eth_call simulation —
/// `evaluate` has no storage writes, only an event, so this is safe).
export async function previewSettlementGate(params: {
  payee: Address;
  amount: bigint;
  minSettlementAmount: bigint;
  minDistinctPayers: number;
  probationCap: bigint;
  externalOracle: Address;
}): Promise<{ allowed: boolean; reason: string }> {
  const { result } = await publicClient.simulateContract({
    address: addresses.settlementGate,
    abi: SettlementGateAbi,
    functionName: "evaluate",
    args: [
      params.payee,
      params.amount,
      params.minSettlementAmount,
      params.minDistinctPayers,
      params.probationCap,
      params.externalOracle,
    ],
  });
  const [allowed, reason] = result as [boolean, string];
  return { allowed, reason };
}
