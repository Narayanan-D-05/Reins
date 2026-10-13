"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { AppNav } from "@/components/app/AppNav";
import { reins, type FeedItem } from "@/lib/reins";

const KIND_LABEL: Record<FeedItem["kind"], string> = {
  PaymentCleared: "Payment cleared",
  PaymentBlocked: "Payment blocked",
  PolicySet: "Policy set",
  Paused: "Revoked",
  AttestationIssued: "Attestation issued",
};

const KIND_CLASS: Record<FeedItem["kind"], string> = {
  PaymentCleared: "text-accent",
  PaymentBlocked: "text-danger",
  PolicySet: "text-text-muted",
  Paused: "text-danger",
  AttestationIssued: "text-text-muted",
};

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { items: next } = await reins.feed(30);
        if (!cancelled) {
          setItems(next);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the feed");
          setStatus("error");
        }
      }
    }

    load();
    const interval = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-16">
      <AppNav />

      <h1 className="display-heading mt-16 text-3xl text-text md:text-4xl">Live feed.</h1>
      <p className="mt-3 max-w-[60ch] text-base text-text-muted">
        Every Reins event across every account, indexed from Monad Testnet by Envio. Refreshes
        every 10 seconds.
      </p>

      {status === "loading" && <p className="mt-10 text-sm text-text-faint">Loading feed…</p>}
      {status === "error" && (
        <p className="mt-10 text-sm text-danger">
          {error ?? "Could not reach the dashboard feed."} The Envio indexer may not be configured.
        </p>
      )}

      {status === "ready" && items.length === 0 && (
        <p className="mt-10 text-sm text-text-faint">No events yet.</p>
      )}

      {status === "ready" && items.length > 0 && (
        <div className="mt-10 divide-y divide-border border border-border">
          {items.map((item, i) => (
            <div key={`${item.txHash}-${i}`} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`font-mono text-sm ${KIND_CLASS[item.kind]}`}>
                  {KIND_LABEL[item.kind]}
                </span>
                <span className="font-mono text-xs text-text-faint">
                  {new Date(Number(item.timestamp) * 1000).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 font-mono text-xs text-text-muted">account {item.account}</p>
              <DetailLine kind={item.kind} detail={item.detail} />
              <p className="mt-2 font-mono text-xs text-text-faint">
                block {item.blockNumber} · tx {item.txHash}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailLine({ kind, detail }: { kind: FeedItem["kind"]; detail: Record<string, unknown> }) {
  if (kind === "PaymentCleared" || kind === "PaymentBlocked") {
    const amount = detail.amount ? formatEther(BigInt(detail.amount as string)) : "0";
    return (
      <p className="mt-1 text-sm text-text">
        {amount} MON to {String(detail.payee)}
        {kind === "PaymentBlocked" && detail.reason ? ` · ${detail.reason}` : ""}
      </p>
    );
  }
  if (kind === "Paused") {
    return (
      <p className="mt-1 text-sm text-text">
        agent {String(detail.agentKey)} {detail.all ? "(all agents)" : ""}
      </p>
    );
  }
  return <p className="mt-1 text-sm text-text">agent {String(detail.agentKey)}</p>;
}
