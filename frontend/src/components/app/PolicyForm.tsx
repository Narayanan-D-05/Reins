"use client";

import { useState } from "react";
import { type Address, parseEther, zeroAddress } from "viem";
import { useSendTransaction, usePublicClient } from "wagmi";
import { reins } from "@/lib/reins";
import { signChallenge, deriveAnotherAgentAddress } from "@/lib/webauthn";
import { getRememberedPasskey, getRememberedAgents, rememberAgentAddress } from "@/lib/passkeyStore";

type Step = "idle" | "building" | "passkey" | "signing" | "confirming" | "done" | "error";

// `account` is passed as this component's React `key` by the caller, so a
// fresh instance (and fresh lazy-initial state below) is mounted whenever
// the selected account changes — no effect needed to resync state to a
// prop.
export function PolicyForm({
  account,
  onUpdated,
}: {
  account: Address;
  onUpdated: (agentKey: Address) => void;
}) {
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState<string | null>(null);

  const [knownAgents, setKnownAgents] = useState(() => getRememberedAgents(account));
  const [agentKey, setAgentKey] = useState<string>(() => knownAgents[0]?.address ?? "");

  async function handleDerive() {
    setDeriveError(null);
    setDeriving(true);
    try {
      const credentialId = getRememberedPasskey(account);
      const nextIndex = knownAgents.length > 0 ? Math.max(...knownAgents.map((a) => a.index)) + 1 : 0;
      const address = await deriveAnotherAgentAddress(nextIndex, credentialId);
      rememberAgentAddress(account, nextIndex, address);
      const updated = getRememberedAgents(account);
      setKnownAgents(updated);
      setAgentKey(address);
    } catch (err) {
      setDeriveError(err instanceof Error ? err.message : "Could not derive an agent key");
    } finally {
      setDeriving(false);
    }
  }
  const [perPaymentCap, setPerPaymentCap] = useState("0.1");
  const [dailyCap, setDailyCap] = useState("1");
  const [expiryDays, setExpiryDays] = useState("30");
  const [minSettlementAmount, setMinSettlementAmount] = useState("0");
  const [minDistinctPayers, setMinDistinctPayers] = useState("0");
  const [probationCap, setProbationCap] = useState("0.05");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicClient) return;
    setError(null);
    setTxHash(null);

    try {
      if (!/^0x[a-fA-F0-9]{40}$/.test(agentKey)) {
        throw new Error("Agent key must be a 0x-prefixed 20-byte address");
      }

      const expiry = String(Math.floor(Date.now() / 1000) + Number(expiryDays) * 86400);
      const params = {
        perPaymentCap: parseEther(perPaymentCap).toString(),
        dailyCap: parseEther(dailyCap).toString(),
        expiry,
        minSettlementAmount: parseEther(minSettlementAmount).toString(),
        minDistinctPayers: Number(minDistinctPayers),
        probationCap: parseEther(probationCap).toString(),
        externalOracle: zeroAddress,
        categories: [],
      };

      setStep("building");
      const { challenge, nonce, validBeforeBlock } = await reins.buildSetPolicyRequest(
        account,
        agentKey as Address,
        params
      );

      setStep("passkey");
      const credentialId = getRememberedPasskey(account);
      const assertion = await signChallenge(challenge, credentialId);

      setStep("signing");
      const { to, data } = await reins.encodeSetPolicyTx(
        account,
        agentKey as Address,
        params,
        nonce,
        validBeforeBlock,
        assertion
      );
      const hash = await sendTransactionAsync({ to, data });

      setStep("confirming");
      await publicClient.waitForTransactionReceipt({ hash });

      setStep("done");
      setTxHash(hash);
      onUpdated(agentKey as Address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  const busy = step === "building" || step === "passkey" || step === "signing" || step === "confirming";

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-bg-elevated p-8">
      <h3 className="text-lg font-medium text-text">Set spending policy</h3>
      <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-text-muted">
        This writes the agent&apos;s leash on-chain, authorized by your passkey. The agent key
        itself can never raise its own caps.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Agent key (address)" className="md:col-span-2">
          <input
            value={agentKey}
            onChange={(e) => setAgentKey(e.target.value)}
            placeholder="0x…"
            required
            className="w-full border border-border-strong bg-bg px-4 py-2.5 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
          />

          {knownAgents.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {knownAgents.map((a) => (
                <button
                  key={a.index}
                  type="button"
                  onClick={() => setAgentKey(a.address)}
                  className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                    agentKey === a.address
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border-strong text-text-muted hover:text-text"
                  }`}
                >
                  agent #{a.index}: {a.address.slice(0, 6)}…{a.address.slice(-4)}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleDerive}
            disabled={deriving}
            className="mt-2 text-xs text-accent underline-offset-2 hover:underline disabled:opacity-50"
          >
            {deriving
              ? "Confirm with passkey…"
              : knownAgents.length > 0
                ? "Derive another agent key from this passkey"
                : "Derive an agent key from this account's passkey"}
          </button>
          {deriveError && <p className="mt-1 text-xs text-danger">{deriveError}</p>}
        </Field>
        <Field label="Per-payment cap (MON)">
          <NumberInput value={perPaymentCap} onChange={setPerPaymentCap} />
        </Field>
        <Field label="Daily cap (MON)">
          <NumberInput value={dailyCap} onChange={setDailyCap} />
        </Field>
        <Field label="Probation cap (MON)">
          <NumberInput value={probationCap} onChange={setProbationCap} />
        </Field>
        <Field label="Policy expires in (days)">
          <NumberInput value={expiryDays} onChange={setExpiryDays} step="1" />
        </Field>
        <Field label="Min settlement amount for counterparty (MON)">
          <NumberInput value={minSettlementAmount} onChange={setMinSettlementAmount} />
        </Field>
        <Field label="Min distinct payers for counterparty">
          <NumberInput value={minDistinctPayers} onChange={setMinDistinctPayers} step="1" />
        </Field>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
      >
        {step === "building" && "Preparing…"}
        {step === "passkey" && "Confirm with passkey…"}
        {step === "signing" && "Confirm in wallet…"}
        {step === "confirming" && "Writing to chain…"}
        {(step === "idle" || step === "done" || step === "error") && "Sign & set policy"}
      </button>

      {step === "done" && txHash && (
        <p className="mt-3 font-mono text-xs text-accent">Policy set, tx {txHash}</p>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs uppercase tracking-wide text-text-faint">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  step = "0.001",
}: {
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <input
      type="number"
      min="0"
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
      className="w-full border border-border-strong bg-bg px-4 py-2.5 font-mono text-sm text-text focus:border-accent focus:outline-none"
    />
  );
}
