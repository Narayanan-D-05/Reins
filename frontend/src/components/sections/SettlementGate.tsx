"use client";

import { motion } from "motion/react";
import { revealUp } from "@/lib/motion";

const ROWS = [
  {
    label: "Tier 1, native score",
    detail: "Computed from Reins' own cleared-payment history. Anyone can recompute it from public events.",
  },
  {
    label: "Tier 2, external oracle",
    detail: "Opt-in, swappable, only used when a counterparty has never transacted through Reins before.",
  },
  {
    label: "Probation cap",
    detail: "A small trial payment is still allowed, so a brand-new honest counterparty is not locked out forever.",
  },
];

export function SettlementGate() {
  return (
    <section id="settlement-gate" className="mx-auto max-w-7xl px-6 py-24 md:py-32">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <motion.h2 {...revealUp} className="display-heading text-3xl text-text md:text-4xl">
            No proof. No payment.
          </motion.h2>
          <motion.p
            {...revealUp}
            transition={{ ...revealUp.transition, delay: 0.1 }}
            className="mt-6 max-w-[48ch] text-base leading-relaxed text-text-muted"
          >
            No address can rate, vote on, or vouch for a counterparty. The only inputs are real
            cleared payments and, optionally, one disclosed external oracle.
          </motion.p>
        </div>

        <div className="md:col-span-7">
          <div className="border border-border bg-bg-elevated p-8 md:p-10">
            <GateDiagram />
            <div className="mt-10 divide-y divide-border">
              {ROWS.map((row, i) => (
                <motion.div
                  key={row.label}
                  {...revealUp}
                  transition={{ ...revealUp.transition, delay: i * 0.08 }}
                  className="py-5"
                >
                  <div className="font-mono text-sm text-accent">{row.label}</div>
                  <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-text-muted">{row.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GateDiagram() {
  return (
    <svg viewBox="0 0 560 120" className="w-full" fill="none" aria-hidden="true">
      <motion.g
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.3 }}
      >
        {[
          { x: 10, label: "Payment" },
          { x: 160, label: "Tier 1" },
          { x: 310, label: "Tier 2" },
          { x: 460, label: "Clear" },
        ].map((node) => (
          <g key={node.label}>
            <rect
              x={node.x}
              y={40}
              width={92}
              height={40}
              className="fill-bg-elevated-2 stroke-border-strong"
              strokeWidth={1}
            />
            <text
              x={node.x + 46}
              y={64}
              textAnchor="middle"
              className="fill-text font-mono text-[11px]"
            >
              {node.label}
            </text>
          </g>
        ))}
        {[102, 252, 402].map((x, i) => (
          <motion.line
            key={x}
            x1={x}
            y1={60}
            x2={x + 58}
            y2={60}
            className="stroke-accent"
            strokeWidth={1.5}
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.15, ease: [0.23, 1, 0.32, 1] }}
          />
        ))}
      </motion.g>
    </svg>
  );
}
