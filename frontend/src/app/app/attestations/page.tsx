"use client";

import { useState } from "react";
import { AppNav } from "@/components/app/AppNav";
import { reins } from "@/lib/reins";

type Result = Awaited<ReturnType<typeof reins.verifyAttestation>>;

export default function AttestationsPage() {
  const [attestationId, setAttestationId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      const data = await reins.verifyAttestation(attestationId);
      setResult(data);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify that attestation");
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-16">
      <AppNav />

      <h1 className="display-heading mt-16 text-3xl text-text md:text-4xl">Verify an attestation.</h1>
      <p className="mt-3 max-w-[60ch] text-base text-text-muted">
        No account, no API key. This re-checks live state through the issuing account, not a
        cached flag, so a revoked agent shows up here immediately.
      </p>

      <form onSubmit={handleVerify} className="mt-10 flex flex-wrap gap-4">
        <input
          value={attestationId}
          onChange={(e) => setAttestationId(e.target.value)}
          placeholder="Attestation ID"
          required
          className="min-w-64 flex-1 border border-border-strong bg-bg px-4 py-3 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
        >
          {status === "loading" ? "Verifying…" : "Verify"}
        </button>
      </form>

      {error && <p className="mt-6 text-sm text-danger">{error}</p>}

      {result && (
        <div className="mt-8 border border-border bg-bg-elevated p-8">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                result.valid ? "bg-accent" : "bg-danger"
              }`}
            />
            <span className={`font-mono text-lg ${result.valid ? "text-accent" : "text-danger"}`}>
              {result.valid ? "Valid" : "Invalid"}
            </span>
            <span className="text-sm text-text-muted">· {result.reason}</span>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 text-sm md:grid-cols-2">
            <Row label="Account" value={result.attestation.account} />
            <Row label="Agent key" value={result.attestation.agentKey} />
            <Row label="Mandate digest" value={result.attestation.mandateDigest} />
            <Row label="Receipt ID" value={result.attestation.receiptId} />
            <Row label="Issued at block" value={result.attestation.issuedAtBlock} />
          </dl>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-text-faint">{label}</div>
      <div className="mt-1 break-all font-mono text-text">{value}</div>
    </div>
  );
}
