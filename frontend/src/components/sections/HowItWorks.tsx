"use client";

import { motion } from "motion/react";
import { Fingerprint, ShieldCheck, Certificate, HandPalm } from "@phosphor-icons/react";
import { revealUpStagger } from "@/lib/motion";

const STEPS = [
  {
    icon: Fingerprint,
    title: "Stake",
    body: "The owner derives a signing key for the agent from one WebAuthn passkey, re-derivable on any device.",
    specs: [
      ["Derivation", "BIP-44 path"],
      ["Device", "Any, re-derivable"],
    ],
  },
  {
    icon: ShieldCheck,
    title: "Guard",
    body: "Every agent payment calls pay(). The guard checks the spending policy and the settlement gate first.",
    specs: [
      ["Entry point", "pay()"],
      ["Checks", "Policy + settlement gate"],
    ],
  },
  {
    icon: Certificate,
    title: "Attest",
    body: "A signed statement, checkable by anyone on Monad. It re-checks live state, not a frozen flag.",
    specs: [
      ["Latency", "~800ms"],
      ["Check", "Live, not frozen"],
    ],
  },
  {
    icon: HandPalm,
    title: "Revoke",
    body: "A Face ID assertion, verified on-chain via the P256 precompile, kills the agent from the next block on.",
    specs: [
      ["Verifier", "0x0100 precompile"],
      ["Effect", "Next block on"],
    ],
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24 md:py-32">
      <h2 className="display-heading max-w-2xl text-3xl text-text md:text-4xl">
        Four stops. One passkey.
      </h2>
      <p className="mt-4 max-w-[52ch] text-base text-text-muted">
        The whole journey of a payment, from the key that authorizes it to the revocation that
        kills it.
      </p>

      <div className="relative mt-16 hidden md:block">
        <div className="absolute left-0 right-0 top-[11px] h-px bg-border-strong" />
        <div className="grid grid-cols-4">
          {STEPS.map((_, i) => (
            <div key={i} className="flex">
              <span
                className={`h-[22px] w-[22px] rounded-full border-2 ${
                  i === STEPS.length - 1 ? "border-accent bg-accent" : "border-border-strong bg-bg"
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-10 md:mt-8 md:grid-cols-4 md:gap-8">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div key={step.title} {...revealUpStagger(i)}>
              <Icon size={24} weight="light" className="text-accent" />
              <h3 className="display-heading mt-4 text-lg text-text">{step.title}</h3>
              <p className="mt-3 max-w-[32ch] text-sm leading-relaxed text-text-muted">{step.body}</p>

              <div className="mt-6 divide-y divide-border border-t border-border">
                {step.specs.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 py-2">
                    <span className="text-xs text-text-faint">{label}</span>
                    <span className="font-mono text-xs text-text-muted">{value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
