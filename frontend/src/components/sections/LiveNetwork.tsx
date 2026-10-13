"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { revealUpStagger } from "@/lib/motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";

interface NetworkData {
  chainId: number;
  blockNumber: string;
  totalPaymentsCleared: string;
  totalPaymentsBlocked: string;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: NetworkData };

export function LiveNetwork() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [chainRes, meterRes] = await Promise.all([
          fetch(`${API_URL}/chain/info`),
          fetch(`${API_URL}/dashboard/at-risk-meter`),
        ]);
        if (!chainRes.ok || !meterRes.ok) throw new Error("request failed");
        const chain = await chainRes.json();
        const meter = await meterRes.json();
        if (cancelled) return;
        setState({
          status: "ready",
          data: {
            chainId: chain.chainId,
            blockNumber: chain.blockNumber,
            totalPaymentsCleared: meter.totalPaymentsCleared,
            totalPaymentsBlocked: meter.totalPaymentsBlocked,
          },
        });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="network" className="mx-auto max-w-7xl px-6 py-24 md:py-32">
      <h2 className="display-heading text-3xl text-text md:text-4xl">
        Read directly from Monad Testnet.
      </h2>
      <p className="mt-4 max-w-[52ch] text-base text-text-muted">
        No account, no API key. These numbers come straight from the deployed contracts.
      </p>

      <div className="mt-12 grid grid-cols-2 gap-px border border-border md:grid-cols-4">
        <Stat index={0} label="Chain ID" value={state.status === "ready" ? String(state.data.chainId) : "-"} state={state.status} />
        <Stat index={1} label="Current block" value={state.status === "ready" ? state.data.blockNumber : "-"} state={state.status} />
        <Stat
          index={2}
          label="Payments cleared"
          value={state.status === "ready" ? state.data.totalPaymentsCleared : "-"}
          state={state.status}
        />
        <Stat
          index={3}
          label="Payments blocked"
          value={state.status === "ready" ? state.data.totalPaymentsBlocked : "-"}
          state={state.status}
        />
      </div>

      {state.status === "error" && (
        <p className="mt-4 text-sm text-text-faint">
          The live backend isn&apos;t reachable from here right now. These stats stream directly from
          the Reins API when it&apos;s running.
        </p>
      )}
    </section>
  );
}

function Stat({
  index,
  label,
  value,
  state,
}: {
  index: number;
  label: string;
  value: string;
  state: LoadState["status"];
}) {
  return (
    <motion.div {...revealUpStagger(index)} className="bg-bg-elevated p-6">
      <div className="text-xs uppercase tracking-wide text-text-faint">{label}</div>
      <div className="mt-3 font-mono text-2xl text-text md:text-3xl">
        {state === "loading" ? (
          <span className="inline-block h-8 w-16 animate-pulse bg-bg-elevated-2" />
        ) : (
          value
        )}
      </div>
    </motion.div>
  );
}
