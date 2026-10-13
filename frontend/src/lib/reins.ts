import type { Address, Hex } from "viem";
import { apiGet, apiPost } from "./api";

export interface PolicyParamsInput {
  perPaymentCap: string;
  dailyCap: string;
  expiry: string;
  minSettlementAmount: string;
  minDistinctPayers: number;
  probationCap: string;
  externalOracle: Address;
  categories: Hex[];
}

export interface Assertion {
  authenticatorData: Hex;
  clientDataJSON: string;
  challengeIndex: string;
  typeIndex: string;
  r: string;
  s: string;
}

export interface ReinsAddresses {
  receiptBook: Address;
  attestor: Address;
  settlementGate: Address;
  factory: Address;
  erc8004IdentityRegistry: Address;
}

export const reins = {
  addresses: () => apiGet<ReinsAddresses>("/policy/addresses"),

  createAccountTx: (ownerPubKeyX: string, ownerPubKeyY: string) =>
    apiPost<{ to: Address; data: Hex }>("/accounts/create-tx", { ownerPubKeyX, ownerPubKeyY }),

  accountsFor: (creator: Address) => apiGet<{ accounts: Address[] }>(`/accounts/${creator}`),

  buildSetPolicyRequest: (account: Address, agentKey: Address, params: PolicyParamsInput) =>
    apiPost<{ mandateDigest: Hex; challenge: Hex; nonce: string; validBeforeBlock: string }>(
      "/policy/build-request",
      { account, agentKey, params }
    ),

  encodeSetPolicyTx: (
    account: Address,
    agentKey: Address,
    params: PolicyParamsInput,
    nonce: string,
    validBeforeBlock: string,
    assertion: Assertion
  ) =>
    apiPost<{ to: Address; data: Hex }>("/policy/encode-tx", {
      account,
      agentKey,
      params,
      nonce,
      validBeforeBlock,
      assertion,
    }),

  getPolicy: (account: Address, agentKey: Address) =>
    apiGet<{
      exists: boolean;
      paused: boolean;
      perPaymentCap: string;
      dailyCap: string;
      spentToday: string;
      currentDay: string;
      expiry: string;
      minSettlementAmount: string;
      minDistinctPayers: number;
      probationCap: string;
      externalOracle: Address;
      mandateDigest: Hex;
      categories: Hex[];
    }>(`/policy/${account}/${agentKey}`),

  buildPullReinsRequest: (account: Address, agentKey?: Address) =>
    apiPost<{ challenge: Hex; nonce: string; validBeforeBlock: string }>("/pull-reins/build-request", {
      account,
      agentKey,
    }),

  encodePullReinsTx: (
    account: Address,
    agentKey: Address | undefined,
    nonce: string,
    validBeforeBlock: string,
    assertion: Assertion
  ) =>
    apiPost<{ to: Address; data: Hex }>("/pull-reins/encode-tx", {
      account,
      agentKey,
      nonce,
      validBeforeBlock,
      assertion,
    }),

  settlementScore: (payee: Address) =>
    apiGet<{ totalReceived: string; distinctPayers: string }>(`/settlement/${payee}/score`),

  registerAgentTx: (agentURI: string) =>
    apiPost<{ to: Address; data: Hex }>("/identity/register-tx", { agentURI }),

  setAgentMetadataTx: (agentId: string, metadataKey: string, metadataValue: Hex) =>
    apiPost<{ to: Address; data: Hex }>("/identity/set-metadata-tx", { agentId, metadataKey, metadataValue }),

  agentWallet: (agentId: string) => apiGet<{ wallet: Address }>(`/identity/${agentId}/wallet`),

  agentMetadata: (agentId: string, key: string) =>
    apiGet<{ value: Hex }>(`/identity/${agentId}/metadata?key=${encodeURIComponent(key)}`),

  verifyAttestation: (attestationId: string) =>
    apiGet<{
      valid: boolean;
      reason: string;
      attestation: {
        account: Address;
        agentKey: Address;
        mandateDigest: Hex;
        receiptId: string;
        issuedAtBlock: string;
      };
    }>(`/attestations/${attestationId}/verify`),

  feed: (limit = 20) => apiGet<{ items: FeedItem[] }>(`/dashboard/feed?limit=${limit}`),

  atRiskMeter: () =>
    apiGet<{
      totalPaymentsCleared: string;
      totalPaymentsBlocked: string;
      totalVolumeClearedWei: string;
      blockedBySettlementUnverified: string;
      blockedByRevoked: string;
      blockedByOther: string;
      blockedRatio: number;
    }>("/dashboard/at-risk-meter"),
};

export interface FeedItem {
  kind: "PaymentCleared" | "PaymentBlocked" | "PolicySet" | "Paused" | "AttestationIssued";
  account: Address;
  blockNumber: string;
  timestamp: string;
  txHash: Hex;
  detail: Record<string, unknown>;
}
