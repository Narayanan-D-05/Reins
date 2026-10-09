import { indexer } from "envio";

const GLOBAL_STATS_ID = "global";

async function loadOrInitGlobalStats(context: any) {
  const existing = await context.GlobalStats.get(GLOBAL_STATS_ID);
  return (
    existing ?? {
      id: GLOBAL_STATS_ID,
      totalPaymentsCleared: 0n,
      totalPaymentsBlocked: 0n,
      totalVolumeClearedWei: 0n,
      blockedBySettlementUnverified: 0n,
      blockedByRevoked: 0n,
      blockedByOther: 0n,
    }
  );
}

indexer.onEvent(
  {
    contract: "ReinsAccount",
    event: "PolicySet",
    fields: { transaction: ["hash"], block: ["timestamp"] },
  },
  async ({ event, context }) => {
    const id = `${event.transaction.hash}-${event.logIndex}`;
    await context.PolicySetEvent.set({
      id,
      account: event.srcAddress,
      agentKey: event.params.agentKey,
      mandateDigest: event.params.mandateDigest,
      nonce: event.params.nonce,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      txHash: event.transaction.hash,
    });
  }
);

indexer.onEvent(
  {
    contract: "ReinsAccount",
    event: "Paused",
    fields: { transaction: ["hash"], block: ["timestamp"] },
  },
  async ({ event, context }) => {
    const id = `${event.transaction.hash}-${event.logIndex}`;
    await context.PausedEvent.set({
      id,
      account: event.srcAddress,
      agentKey: event.params.agentKey,
      all: event.params.all,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      txHash: event.transaction.hash,
    });
  }
);

indexer.onEvent(
  {
    contract: "ReinsAccount",
    event: "PaymentCleared",
    fields: { transaction: ["hash"], block: ["timestamp"] },
  },
  async ({ event, context }) => {
    const id = `${event.transaction.hash}-${event.logIndex}`;
    await context.PaymentClearedEvent.set({
      id,
      account: event.srcAddress,
      agentKey: event.params.agentKey,
      payee: event.params.payee,
      amount: event.params.amount,
      category: event.params.category,
      receiptId: event.params.receiptId,
      attestationId: event.params.attestationId,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      txHash: event.transaction.hash,
    });

    const stats = await loadOrInitGlobalStats(context);
    await context.GlobalStats.set({
      ...stats,
      totalPaymentsCleared: stats.totalPaymentsCleared + 1n,
      totalVolumeClearedWei: stats.totalVolumeClearedWei + event.params.amount,
    });
  }
);

indexer.onEvent(
  {
    contract: "ReinsAccount",
    event: "PaymentBlocked",
    fields: { transaction: ["hash"], block: ["timestamp"] },
  },
  async ({ event, context }) => {
    const id = `${event.transaction.hash}-${event.logIndex}`;
    await context.PaymentBlockedEvent.set({
      id,
      account: event.srcAddress,
      agentKey: event.params.agentKey,
      payee: event.params.payee,
      amount: event.params.amount,
      category: event.params.category,
      reason: event.params.reason,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      txHash: event.transaction.hash,
    });

    const stats = await loadOrInitGlobalStats(context);
    const reason = event.params.reason;
    await context.GlobalStats.set({
      ...stats,
      totalPaymentsBlocked: stats.totalPaymentsBlocked + 1n,
      blockedBySettlementUnverified:
        stats.blockedBySettlementUnverified + (reason === "SettlementUnverified" ? 1n : 0n),
      blockedByRevoked: stats.blockedByRevoked + (reason === "Revoked" ? 1n : 0n),
      blockedByOther:
        stats.blockedByOther + (reason !== "SettlementUnverified" && reason !== "Revoked" ? 1n : 0n),
    });
  }
);
