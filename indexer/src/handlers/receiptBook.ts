import { indexer } from "envio";

indexer.onEvent(
  {
    contract: "ReceiptBook",
    event: "ReceiptRecorded",
    fields: { transaction: ["hash"], block: ["timestamp"] },
  },
  async ({ event, context }) => {
    await context.ReceiptRecordedEvent.set({
      id: event.params.receiptId.toString(),
      account: event.params.account,
      payee: event.params.payee,
      agentKey: event.params.agentKey,
      amount: event.params.amount,
      category: event.params.category,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      txHash: event.transaction.hash,
    });
  }
);
