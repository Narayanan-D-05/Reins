"use client";

import ScrollStack, { ScrollStackItem } from "@/components/react-bits/ScrollStack";

const CARDS = [
  {
    stat: "1,275,105",
    label: "AI-service secrets exposed on public GitHub in 2025 alone",
    body: "64% of secrets leaked back in 2022 are still active and exploitable today. Rotating a key rarely means the leak is actually closed.",
    source: "GitGuardian, State of Secrets Sprawl 2026",
  },
  {
    stat: "0 valid",
    label: "feedback entries left after filtering likely Sybil activity",
    body: "An empirical study of the live ERC-8004 ecosystem found its reputation extension cannot function as a trust signal: feedback is rarely grounded in real transactions and is cheap to fake.",
    source: "Xiong et al., 2026",
  },
];

/// Real reactbits.dev ScrollStack (Lenis-smoothed pin + scale), not a
/// hand-rolled approximation — motivated as the same storytelling beat as
/// before: two research findings, pinned and stacked in sequence so each
/// lands before the next arrives.
export function ProblemStack() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 pt-24">
        <h2 className="display-heading max-w-xl text-3xl text-text md:text-4xl">
          Two failures sit underneath every agent payment.
        </h2>
      </div>

      <div className="relative mt-8">
        <ScrollStack
          useWindowScroll
          baseScale={0.9}
          itemScale={0.04}
          itemStackDistance={40}
          stackPosition="18%"
          scaleEndPosition="9%"
          itemDistance={140}
        >
          {CARDS.map((card) => (
            <ScrollStackItem key={card.label}>
              <div className="mx-auto max-w-3xl border border-border bg-bg-elevated p-10 md:p-14">
                <div className="font-mono text-4xl text-accent md:text-5xl">{card.stat}</div>
                <p className="mt-3 text-lg text-text md:text-xl">{card.label}</p>
                <p className="mt-6 max-w-[62ch] text-base leading-relaxed text-text-muted">{card.body}</p>
                <p className="mt-6 font-mono text-xs text-text-faint">{card.source}</p>
              </div>
            </ScrollStackItem>
          ))}
        </ScrollStack>
      </div>
    </section>
  );
}
