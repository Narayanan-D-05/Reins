"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, formatEther } from "viem";
import { reins } from "@/lib/reins";

const AGENT_KEY_RE = /^0x[a-fA-F0-9]{40}$/;

export function PolicyStatus({
  account,
  agentKey,
  refreshKey,
}: {
  account: Address;
  agentKey: string;
  refreshKey: number;
}) {
  const valid = AGENT_KEY_RE.test(agentKey);
  const { data: policy, isLoading, isError } = useQuery({
    queryKey: ["policy", account, agentKey, refreshKey],
    queryFn: () => reins.getPolicy(account, agentKey as Address),
    enabled: valid,
  });

  if (!valid) return null;
  if (isLoading) return <p className="text-sm text-text-faint">Reading policy…</p>;
  if (isError) return <p className="text-sm text-danger">Could not read this policy.</p>;
  if (!policy || !policy.exists) {
    return <p className="text-sm text-text-faint">No policy set for this agent key yet.</p>;
  }

  return (
    <div className="border border-border bg-bg-elevated-2 p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-text-faint">Agent key {agentKey}</span>
        <span
          className={`font-mono text-xs ${policy.paused ? "text-danger" : "text-accent"}`}
        >
          {policy.paused ? "revoked" : "active"}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
        <Row label="Per-payment cap" value={`${formatEther(BigInt(policy.perPaymentCap))} MON`} />
        <Row label="Daily cap" value={`${formatEther(BigInt(policy.dailyCap))} MON`} />
        <Row label="Spent today" value={`${formatEther(BigInt(policy.spentToday))} MON`} />
        <Row
          label="Expires"
          value={new Date(Number(policy.expiry) * 1000).toLocaleString()}
        />
        <Row label="Min settlement" value={`${formatEther(BigInt(policy.minSettlementAmount))} MON`} />
        <Row label="Min distinct payers" value={String(policy.minDistinctPayers)} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-text-faint">{label}</div>
      <div className="mt-1 font-mono text-text">{value}</div>
    </div>
  );
}
