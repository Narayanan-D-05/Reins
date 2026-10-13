"use client";

import type { Address } from "viem";

export function AccountsList({
  accounts,
  selected,
  onSelect,
  loading,
}: {
  accounts: Address[];
  selected: Address | null;
  onSelect: (account: Address) => void;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-text-faint">Loading accounts…</p>;
  }

  if (accounts.length === 0) {
    return <p className="text-sm text-text-faint">No Reins accounts yet for this wallet.</p>;
  }

  return (
    <div className="divide-y divide-border border border-border">
      {accounts.map((account) => (
        <button
          key={account}
          onClick={() => onSelect(account)}
          className={`flex w-full items-center justify-between px-5 py-4 text-left font-mono text-sm transition-colors ${
            selected === account ? "bg-accent-soft text-accent" : "text-text hover:bg-bg-elevated-2"
          }`}
        >
          <span>{account}</span>
          {selected === account && <span className="text-xs">selected</span>}
        </button>
      ))}
    </div>
  );
}
