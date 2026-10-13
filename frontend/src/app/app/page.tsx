"use client";

import { useState } from "react";
import { type Address, type Hex } from "viem";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppNav } from "@/components/app/AppNav";
import { CreateAccount } from "@/components/app/CreateAccount";
import { AccountsList } from "@/components/app/AccountsList";
import { PolicyForm } from "@/components/app/PolicyForm";
import { PolicyStatus } from "@/components/app/PolicyStatus";
import { PullReins } from "@/components/app/PullReins";
import { reins } from "@/lib/reins";
import { rememberPasskey, rememberAgentAddress } from "@/lib/passkeyStore";
import { monadTestnet } from "@/lib/chain";

export default function AppPage() {
  const { address, isConnected, chainId } = useAccount();
  const [selected, setSelected] = useState<Address | null>(null);
  const [lookupAgentKey, setLookupAgentKey] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const ready = isConnected && chainId === monadTestnet.id;
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: ["accounts", address],
    queryFn: () => reins.accountsFor(address as Address).then((r) => r.accounts),
    enabled: ready && !!address,
  });
  const accounts = accountsQuery.data ?? [];

  async function handleAccountCreated(credentialId: string, agentAddress: Hex) {
    const before = accounts;
    const result = await queryClient.fetchQuery({
      queryKey: ["accounts", address],
      queryFn: () => reins.accountsFor(address as Address).then((r) => r.accounts),
    });
    const created = result.find((a) => !before.includes(a));
    if (created) {
      rememberPasskey(created, credentialId);
      rememberAgentAddress(created, 0, agentAddress);
      setSelected(created);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-16">
      <AppNav />

      <h1 className="display-heading mt-16 text-3xl text-text md:text-4xl">Run your account.</h1>
      <p className="mt-3 max-w-[60ch] text-base text-text-muted">
        Create a passkey-rooted account, set the spending leash for an agent key, and pull the
        reins the instant something looks wrong. Every action here signs a real transaction on
        Monad Testnet.
      </p>

      {!ready && (
        <div className="mt-10 border border-border bg-bg-elevated p-8 text-sm text-text-muted">
          Connect a wallet on Monad Testnet to continue.
        </div>
      )}

      {ready && (
        <div className="mt-10 space-y-10">
          <CreateAccount onCreated={handleAccountCreated} />

          <section>
            <h2 className="text-sm uppercase tracking-wide text-text-faint">Your accounts</h2>
            <div className="mt-3">
              <AccountsList
                accounts={accounts}
                selected={selected}
                onSelect={setSelected}
                loading={accountsQuery.isLoading}
              />
            </div>
          </section>

          {selected && (
            <section key={selected} className="space-y-6">
              <h2 className="text-sm uppercase tracking-wide text-text-faint">
                Managing {selected}
              </h2>

              <div>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-text-faint">
                    Look up a policy by agent key
                  </span>
                  <input
                    value={lookupAgentKey}
                    onChange={(e) => setLookupAgentKey(e.target.value)}
                    placeholder="0x…"
                    className="mt-2 w-full border border-border-strong bg-bg px-4 py-2.5 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
                  />
                </label>
                <div className="mt-4">
                  <PolicyStatus account={selected} agentKey={lookupAgentKey} refreshKey={refreshKey} />
                </div>
              </div>

              <PolicyForm
                account={selected}
                onUpdated={(agentKey) => {
                  setLookupAgentKey(agentKey);
                  setRefreshKey((k) => k + 1);
                }}
              />
              <PullReins account={selected} onRevoked={() => setRefreshKey((k) => k + 1)} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
