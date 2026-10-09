import { indexer } from "envio";

indexer.onEvent(
  {
    contract: "Attestor",
    event: "AttestationIssued",
    fields: { transaction: ["hash"], block: ["timestamp"] },
  },
  async ({ event, context }) => {
    await context.AttestationIssuedEvent.set({
      id: event.params.attestationId.toString(),
      account: event.params.account,
      agentKey: event.params.agentKey,
      receiptId: event.params.receiptId,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      txHash: event.transaction.hash,
    });
  }
);
