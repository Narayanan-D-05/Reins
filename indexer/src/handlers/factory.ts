import { indexer } from "envio";

/// Every ReinsAccount is a per-owner instance deployed at runtime by
/// ReinsAccountFactory — there is no static address to configure, so each
/// new instance is registered for indexing here as soon as it's created.
indexer.contractRegister(
  { contract: "ReinsAccountFactory", event: "AccountCreated" },
  ({ event, context }) => {
    context.chain.ReinsAccount.add(event.params.account);
    context.log.info(`Tracking new ReinsAccount at ${event.params.account}`);
  }
);

indexer.onEvent(
  {
    contract: "ReinsAccountFactory",
    event: "AccountCreated",
    fields: { block: ["timestamp"] },
  },
  async ({ event, context }) => {
    await context.ReinsAccountEntity.set({
      id: event.params.account,
      creator: event.params.creator,
      ownerPubKeyX: event.params.ownerPubKeyX,
      ownerPubKeyY: event.params.ownerPubKeyY,
      createdAtBlock: BigInt(event.block.number),
      createdAtTimestamp: BigInt(event.block.timestamp),
    });
  }
);
