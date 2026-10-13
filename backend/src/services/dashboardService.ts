import { env } from "../config/env.js";

/// Queries the Envio-indexed GraphQL API for the live dashboard feed and
/// at-risk meter (PRD §7, §12 MUST BUILD). Schema and field names verified
/// directly against the deployed indexer's own introspection — see
/// indexer/schema.graphql for the entities this mirrors.

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export class DashboardNotConfiguredError extends Error {
  constructor() {
    super("ENVIO_GRAPHQL_ENDPOINT is not configured — dashboard routes are disabled.");
    this.name = "DashboardNotConfiguredError";
  }
}

async function graphqlQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!env.ENVIO_GRAPHQL_ENDPOINT) {
    throw new DashboardNotConfiguredError();
  }
  const res = await fetch(env.ENVIO_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    throw new Error(`Envio GraphQL error: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  return body.data as T;
}

export interface FeedItem {
  kind: "PaymentCleared" | "PaymentBlocked" | "PolicySet" | "Paused" | "AttestationIssued";
  account: string;
  blockNumber: string;
  timestamp: string;
  txHash: string;
  detail: Record<string, unknown>;
}

interface FeedQueryResult {
  PaymentClearedEvent: Array<{
    account: string;
    agentKey: string;
    payee: string;
    amount: string;
    category: string;
    attestationId: string;
    blockNumber: string;
    timestamp: string;
    txHash: string;
  }>;
  PaymentBlockedEvent: Array<{
    account: string;
    agentKey: string;
    payee: string;
    amount: string;
    category: string;
    reason: string;
    blockNumber: string;
    timestamp: string;
    txHash: string;
  }>;
  PolicySetEvent: Array<{
    account: string;
    agentKey: string;
    mandateDigest: string;
    nonce: string;
    blockNumber: string;
    timestamp: string;
    txHash: string;
  }>;
  PausedEvent: Array<{
    account: string;
    agentKey: string;
    all: boolean;
    blockNumber: string;
    timestamp: string;
    txHash: string;
  }>;
  AttestationIssuedEvent: Array<{
    account: string;
    agentKey: string;
    receiptId: string;
    blockNumber: string;
    timestamp: string;
    txHash: string;
  }>;
}

const FEED_QUERY = `
  query Feed($limit: Int!) {
    PaymentClearedEvent(limit: $limit, order_by: { timestamp: desc }) {
      account agentKey payee amount category attestationId blockNumber timestamp txHash
    }
    PaymentBlockedEvent(limit: $limit, order_by: { timestamp: desc }) {
      account agentKey payee amount category reason blockNumber timestamp txHash
    }
    PolicySetEvent(limit: $limit, order_by: { timestamp: desc }) {
      account agentKey mandateDigest nonce blockNumber timestamp txHash
    }
    PausedEvent(limit: $limit, order_by: { timestamp: desc }) {
      account agentKey all blockNumber timestamp txHash
    }
    AttestationIssuedEvent(limit: $limit, order_by: { timestamp: desc }) {
      account agentKey receiptId blockNumber timestamp txHash
    }
  }
`;

/// Merges every Reins event type into one timestamp-sorted feed, capped at
/// `limit`. This is the raw feed a dashboard renders — no aggregation.
export async function getDashboardFeed(limit = 20): Promise<FeedItem[]> {
  const data = await graphqlQuery<FeedQueryResult>(FEED_QUERY, { limit });

  const items: FeedItem[] = [
    ...data.PaymentClearedEvent.map((e) => ({
      kind: "PaymentCleared" as const,
      account: e.account,
      blockNumber: e.blockNumber,
      timestamp: e.timestamp,
      txHash: e.txHash,
      detail: { agentKey: e.agentKey, payee: e.payee, amount: e.amount, category: e.category, attestationId: e.attestationId },
    })),
    ...data.PaymentBlockedEvent.map((e) => ({
      kind: "PaymentBlocked" as const,
      account: e.account,
      blockNumber: e.blockNumber,
      timestamp: e.timestamp,
      txHash: e.txHash,
      detail: { agentKey: e.agentKey, payee: e.payee, amount: e.amount, category: e.category, reason: e.reason },
    })),
    ...data.PolicySetEvent.map((e) => ({
      kind: "PolicySet" as const,
      account: e.account,
      blockNumber: e.blockNumber,
      timestamp: e.timestamp,
      txHash: e.txHash,
      detail: { agentKey: e.agentKey, mandateDigest: e.mandateDigest, nonce: e.nonce },
    })),
    ...data.PausedEvent.map((e) => ({
      kind: "Paused" as const,
      account: e.account,
      blockNumber: e.blockNumber,
      timestamp: e.timestamp,
      txHash: e.txHash,
      detail: { agentKey: e.agentKey, all: e.all },
    })),
    ...data.AttestationIssuedEvent.map((e) => ({
      kind: "AttestationIssued" as const,
      account: e.account,
      blockNumber: e.blockNumber,
      timestamp: e.timestamp,
      txHash: e.txHash,
      detail: { agentKey: e.agentKey, receiptId: e.receiptId },
    })),
  ];

  items.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  return items.slice(0, limit);
}

export interface AtRiskMeter {
  totalPaymentsCleared: string;
  totalPaymentsBlocked: string;
  totalVolumeClearedWei: string;
  blockedBySettlementUnverified: string;
  blockedByRevoked: string;
  blockedByOther: string;
  /// blocked / (cleared + blocked), 0 when nothing has happened yet.
  blockedRatio: number;
}

interface GlobalStatsResult {
  GlobalStats: Array<{
    totalPaymentsCleared: string;
    totalPaymentsBlocked: string;
    totalVolumeClearedWei: string;
    blockedBySettlementUnverified: string;
    blockedByRevoked: string;
    blockedByOther: string;
  }>;
}

const GLOBAL_STATS_QUERY = `
  query GlobalStats {
    GlobalStats(where: { id: { _eq: "global" } }) {
      totalPaymentsCleared
      totalPaymentsBlocked
      totalVolumeClearedWei
      blockedBySettlementUnverified
      blockedByRevoked
      blockedByOther
    }
  }
`;

/// The settlement-gate at-risk meter (PRD §7, §12 MUST BUILD): what
/// fraction of attempted payments across every Reins account are being
/// blocked, and why.
export async function getAtRiskMeter(): Promise<AtRiskMeter> {
  const data = await graphqlQuery<GlobalStatsResult>(GLOBAL_STATS_QUERY);
  const row = data.GlobalStats[0];

  if (!row) {
    return {
      totalPaymentsCleared: "0",
      totalPaymentsBlocked: "0",
      totalVolumeClearedWei: "0",
      blockedBySettlementUnverified: "0",
      blockedByRevoked: "0",
      blockedByOther: "0",
      blockedRatio: 0,
    };
  }

  const cleared = Number(row.totalPaymentsCleared);
  const blocked = Number(row.totalPaymentsBlocked);
  const total = cleared + blocked;

  return { ...row, blockedRatio: total === 0 ? 0 : blocked / total };
}
