"use client";

import { useState } from "react";
import { type Hex, stringToHex } from "viem";
import { useSendTransaction, usePublicClient, useAccount } from "wagmi";
import { reins } from "@/lib/reins";

type Step = "idle" | "signing" | "confirming" | "done" | "error";

export function RegisterAgent() {
  const { isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [agentURI, setAgentURI] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicClient) return;
    setError(null);
    try {
      setStep("signing");
      const { to, data } = await reins.registerAgentTx(agentURI);
      const hash = await sendTransactionAsync({ to, data });
      setTxHash(hash);

      setStep("confirming");
      await publicClient.waitForTransactionReceipt({ hash });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  const busy = step === "signing" || step === "confirming";

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-bg-elevated p-8">
      <h3 className="text-lg font-medium text-text">Register an agent identity</h3>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-text-muted">
        ERC-8004 registration is independent of a Reins account: the agent key registers itself
        directly against the registry. Connect the agent&apos;s own wallet here, not the owner
        wallet used on the Account page.
      </p>

      <label className="mt-6 block">
        <span className="text-xs uppercase tracking-wide text-text-faint">Agent metadata URI</span>
        <input
          value={agentURI}
          onChange={(e) => setAgentURI(e.target.value)}
          placeholder="https://…/agent-card.json"
          type="url"
          required
          className="mt-2 w-full border border-border-strong bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={busy || !isConnected}
        className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
      >
        {step === "signing" && "Confirm in wallet…"}
        {step === "confirming" && "Registering…"}
        {(step === "idle" || step === "done" || step === "error") &&
          (isConnected ? "Register agent" : "Connect a wallet first")}
      </button>

      {step === "done" && txHash && (
        <p className="mt-3 font-mono text-xs text-accent">Registered, tx {txHash}</p>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </form>
  );
}

export function SetAgentMetadata() {
  const { isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [agentId, setAgentId] = useState("");
  const [metadataKey, setMetadataKey] = useState("");
  const [metadataValue, setMetadataValue] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicClient) return;
    setError(null);
    try {
      setStep("signing");
      const valueHex = stringToHex(metadataValue);
      const { to, data } = await reins.setAgentMetadataTx(agentId, metadataKey, valueHex);
      const hash = await sendTransactionAsync({ to, data });

      setStep("confirming");
      await publicClient.waitForTransactionReceipt({ hash });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  const busy = step === "signing" || step === "confirming";

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-bg-elevated p-8">
      <h3 className="text-lg font-medium text-text">Set agent metadata</h3>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-text-muted">
        Writes a key/value pair against an already-registered agent ID. Only that agent&apos;s own
        wallet can set its metadata.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-text-faint">Agent ID</span>
          <input
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="1"
            required
            className="mt-2 w-full border border-border-strong bg-bg px-4 py-2.5 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-text-faint">Key</span>
          <input
            value={metadataKey}
            onChange={(e) => setMetadataKey(e.target.value)}
            placeholder="capability"
            required
            className="mt-2 w-full border border-border-strong bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-text-faint">Value</span>
          <input
            value={metadataValue}
            onChange={(e) => setMetadataValue(e.target.value)}
            placeholder="procurement"
            required
            className="mt-2 w-full border border-border-strong bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={busy || !isConnected}
        className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
      >
        {step === "signing" && "Confirm in wallet…"}
        {step === "confirming" && "Writing…"}
        {(step === "idle" || step === "done" || step === "error") &&
          (isConnected ? "Set metadata" : "Connect a wallet first")}
      </button>

      {step === "done" && <p className="mt-3 text-sm text-accent">Metadata updated.</p>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </form>
  );
}

export function AgentLookup() {
  const [agentId, setAgentId] = useState("");
  const [metadataKey, setMetadataKey] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [metadataValue, setMetadataValue] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    setWallet(null);
    setMetadataValue(null);
    try {
      const { wallet: w } = await reins.agentWallet(agentId);
      setWallet(w);
      if (metadataKey) {
        const { value } = await reins.agentMetadata(agentId, metadataKey);
        setMetadataValue(value);
      }
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleLookup} className="border border-border bg-bg-elevated-2 p-6">
      <h3 className="text-sm font-medium text-text">Look up an agent</h3>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="Agent ID"
          required
          className="border border-border-strong bg-bg px-4 py-2.5 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
        <input
          value={metadataKey}
          onChange={(e) => setMetadataKey(e.target.value)}
          placeholder="Metadata key (optional)"
          className="border border-border-strong bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-full border border-border-strong px-5 py-2.5 text-sm text-text transition-all duration-150 ease-out hover:border-accent hover:text-accent active:scale-[0.97] disabled:opacity-50"
        >
          {status === "loading" ? "Looking up…" : "Look up"}
        </button>
      </div>

      {wallet && (
        <p className="mt-4 font-mono text-sm text-text">
          Wallet: <span className="text-accent">{wallet}</span>
        </p>
      )}
      {metadataValue && <p className="mt-2 font-mono text-sm text-text-muted">Metadata: {metadataValue}</p>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </form>
  );
}
