"use client";

import { motion } from "motion/react";
import { revealUp } from "@/lib/motion";

const ROWS = [
  {
    approach: "Skyfire, SatGate, ATXP",
    gap: "Each runs its own database. Checking a revocation means joining that company's platform.",
    status: "Vendor database",
    tone: "bad" as const,
  },
  {
    approach: "Displayed trust scores",
    gap: "Reward whoever makes the best-looking badge. Feedback is rarely grounded in a real transaction.",
    status: "Self-reported",
    tone: "bad" as const,
  },
  {
    approach: "W3C Status List",
    gap: "The revocation format is neutral, but it's still hosted by the original issuer.",
    status: "Issuer-hosted",
    tone: "warn" as const,
  },
  {
    approach: "Okta agent governance",
    gap: "Access control, not spending caps. One company's identity perimeter either way.",
    status: "Perimeter only",
    tone: "warn" as const,
  },
  {
    approach: "Reins",
    gap: "Checkable by anyone directly against Monad. Counterparty trust comes from real cleared payments only.",
    status: "Checkable, not self-reported",
    tone: "good" as const,
  },
];

const DOT_CLASS: Record<string, string> = {
  bad: "bg-danger",
  warn: "bg-amber-400",
  good: "bg-accent",
};

export function Comparison() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 md:py-32">
      <motion.h2 {...revealUp} className="display-heading max-w-2xl text-3xl text-text md:text-4xl">
        Every fix so far keeps a record or picks a gatekeeper.
      </motion.h2>
      <motion.p
        {...revealUp}
        transition={{ ...revealUp.transition, delay: 0.08 }}
        className="mt-4 max-w-[56ch] text-base text-text-muted"
      >
        Anyone running a kill switch today has to choose: trust their database, or trust nobody.
        This is what is on the board.
      </motion.p>

      <div className="mt-12 overflow-hidden border border-border">
        <div className="hidden grid-cols-[1.2fr_2fr_1fr] gap-6 border-b border-border px-6 py-3 text-xs uppercase tracking-wide text-text-faint md:grid">
          <span>Approach</span>
          <span>Where it breaks for agents</span>
          <span>Status</span>
        </div>
        {ROWS.map((row, i) => (
          <motion.div
            key={row.approach}
            {...revealUp}
            transition={{ ...revealUp.transition, delay: i * 0.06 }}
            className={`grid grid-cols-1 gap-2 border-b border-border px-6 py-5 last:border-b-0 md:grid-cols-[1.2fr_2fr_1fr] md:items-center md:gap-6 ${
              row.tone === "good" ? "bg-accent-soft" : ""
            }`}
          >
            <span className="font-medium text-text">{row.approach}</span>
            <span className="text-sm leading-relaxed text-text-muted">{row.gap}</span>
            <span className="flex items-center gap-2 font-mono text-xs text-text-muted">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT_CLASS[row.tone]}`} />
              {row.status}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
