"use client";

import { useState } from "react";
import { type Address } from "viem";
import { useSendTransaction, usePublicClient } from "wagmi";
import { reins } from "@/lib/reins";
import { signChallenge } from "@/lib/webauthn";
import { getRememberedPasskey } from "@/lib/passkeyStore";

type Step = "idle" | "building" | "passkey" | "signing" | "confirming" | "done" | "error";

export function PullReins({ account, onRevoked }: { account: Address; onRevoked: () => void }) {
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [agentKey, setAgentKey] = useState("");
  const [revokeAll, setRevokeAll] = useState(false);

  async function handleRevoke() {
    if (!publicClient) return;
    setError(null);
    setTxHash(null);

    try {
      const target = revokeAll ? undefined : (agentKey as Address);
      if (!revokeAll && !/^0x[a-fA-F0-9]{40}$/.test(agentKey)) {
        throw new Error("Agent key must be a 0x-prefixed 20-byte address, or check “revoke all”");
      }

      setStep("building");
      const { challenge, nonce, validBeforeBlock } = await reins.buildPullReinsRequest(account, target);

      setStep("passkey");
      const credentialId = getRememberedPasskey(account);
      const assertion = await signChallenge(challenge, credentialId);

      setStep("signing");
      const { to, data } = await reins.encodePullReinsTx(account, target, nonce, validBeforeBlock, assertion);
      const hash = await sendTransactionAsync({ to, data });

      setStep("confirming");
      await publicClient.waitForTransactionReceipt({ hash });

      setStep("done");
      setTxHash(hash);
      onRevoked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  const busy = step === "building" || step === "passkey" || step === "signing" || step === "confirming";

  return (
    <div className="border border-danger/40 bg-bg-elevated p-8">
      <h3 className="text-lg font-medium text-text">Pull the reins</h3>
      <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-text-muted">
        Revokes an agent&apos;s ability to spend, effective from the next block. A Face ID /
        passkey assertion is the only thing that can do this.
      </p>

      <label className="mt-6 flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={revokeAll}
          onChange={(e) => setRevokeAll(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        Revoke every agent under this account
      </label>

      {!revokeAll && (
        <input
          value={agentKey}
          onChange={(e) => setAgentKey(e.target.value)}
          placeholder="0x… agent key to revoke"
          className="mt-4 w-full border border-border-strong bg-bg px-4 py-2.5 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
      )}

      <button
        onClick={handleRevoke}
        disabled={busy}
        className="mt-6 rounded-full bg-danger px-6 py-3 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
      >
        {step === "building" && "Preparing…"}
        {step === "passkey" && "Confirm with passkey…"}
        {step === "signing" && "Confirm in wallet…"}
        {step === "confirming" && "Revoking…"}
        {(step === "idle" || step === "done" || step === "error") && "Pull the reins"}
      </button>

      {step === "done" && txHash && (
        <p className="mt-3 font-mono text-xs text-danger">Revoked, tx {txHash}</p>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
