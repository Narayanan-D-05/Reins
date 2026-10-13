"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { useAccount, useSendTransaction, usePublicClient } from "wagmi";
import { createPasskey } from "@/lib/webauthn";
import { reins } from "@/lib/reins";

type Step = "idle" | "passkey" | "signing" | "confirming" | "done" | "error";

export function CreateAccount({
  onCreated,
}: {
  onCreated: (credentialId: string, agentAddress: Hex) => void;
}) {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  async function handleCreate() {
    if (!address || !publicClient) return;
    setError(null);
    try {
      setStep("passkey");
      const passkey = await createPasskey(label || "Reins agent owner");

      setStep("signing");
      const { to, data } = await reins.createAccountTx(passkey.publicKeyX, passkey.publicKeyY);
      const hash = await sendTransactionAsync({ to, data });

      setStep("confirming");
      await publicClient.waitForTransactionReceipt({ hash });

      setStep("done");
      onCreated(passkey.credentialId, passkey.agentAddress);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  return (
    <div className="border border-border bg-bg-elevated p-8">
      <h3 className="text-lg font-medium text-text">Create a new account</h3>
      <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-text-muted">
        This creates one passkey on this device (Face ID, Touch ID, Windows Hello, or a security
        key) and deploys a Reins account rooted to it. The same passkey also deterministically
        derives the agent&apos;s own spending key, via Mera, re-derivable on any device with no
        key ever stored anywhere. Your wallet pays the gas and is only ever the deployer on
        record.
      </p>

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label this passkey (e.g. “Procurement agent owner”)"
        className="mt-6 w-full border border-border-strong bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
      />

      <button
        onClick={handleCreate}
        disabled={step === "passkey" || step === "signing" || step === "confirming"}
        className="mt-4 rounded-full bg-accent px-6 py-3 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
      >
        {step === "passkey" && "Waiting for passkey…"}
        {step === "signing" && "Confirm in wallet…"}
        {step === "confirming" && "Deploying account…"}
        {(step === "idle" || step === "done" || step === "error") && "Create passkey + account"}
      </button>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
