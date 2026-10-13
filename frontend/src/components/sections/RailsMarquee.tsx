"use client";

import { useReducedMotion } from "motion/react";

const RAILS = [
  "Google AP2 / UCP",
  "Coinbase x402",
  "Visa Trusted Agent Protocol",
  "Mastercard Agent Pay",
  "ERC-8004 identity",
  "Any outsider's own node",
];

export function RailsMarquee() {
  const reduceMotion = useReducedMotion();
  const items = [...RAILS, ...RAILS];

  return (
    <section className="overflow-hidden border-y border-border bg-bg-elevated py-10">
      <p className="mx-auto mb-6 max-w-7xl px-6 text-sm text-text-faint">
        One attestation, checkable from any of these, with no account or contract with Reins.
      </p>
      <div className="relative">
        <div
          className={`flex gap-16 whitespace-nowrap font-mono text-lg text-text-muted ${
            reduceMotion ? "" : "animate-marquee"
          }`}
        >
          {items.map((rail, i) => (
            <span key={`${rail}-${i}`}>{rail}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
