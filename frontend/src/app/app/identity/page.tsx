"use client";

import { AppNav } from "@/components/app/AppNav";
import { RegisterAgent, SetAgentMetadata, AgentLookup } from "@/components/app/IdentityRegistration";

export default function IdentityPage() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-16">
      <AppNav />

      <h1 className="display-heading mt-16 text-3xl text-text md:text-4xl">Agent identity.</h1>
      <p className="mt-3 max-w-[60ch] text-base text-text-muted">
        ERC-8004 identity registration, directly against the public registry on Monad Testnet.
        Reins never relays or holds these transactions.
      </p>

      <div className="mt-10 space-y-8">
        <RegisterAgent />
        <SetAgentMetadata />
        <AgentLookup />
      </div>
    </div>
  );
}
