"use client";

import { motion } from "motion/react";
import { revealUpStagger } from "@/lib/motion";

const ITEMS = [
  {
    title: "Cold start looks like fraud.",
    body: "A brand-new, honest counterparty has zero settlement history, indistinguishable at first glance from a scam. The probation cap allows a small trial payment instead of an outright block, not a full fix.",
  },
  {
    title: "Tier 2 is a vendor dependency, on purpose.",
    body: "An external oracle is one company's server for that one check. It's opt-in and swappable, and never the only gate, but it isn't neutral the way Reins' own attestation is.",
  },
  {
    title: "A compromised passkey still spends within its last policy.",
    body: "Revocation stops a leaked key going forward. It doesn't undo what that key was already allowed to do before you pulled the reins.",
  },
  {
    title: "Recovery after a bad payment clears isn't solved yet.",
    body: "Reins prevents and reveals; it doesn't yet reverse. A flagged-payment hold is on the roadmap, not in this build.",
  },
];

/// This section exists because the PRD itself does (§6.4, §11, §14): Reins
/// scored 65/100 on an independent adversarial review and the whole
/// project treats that as a feature of its own honesty, not something to
/// hide from a landing page.
export function Limitations() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 md:py-32">
      <h2 className="display-heading max-w-2xl text-3xl text-text md:text-4xl">
        What Reins does not do.
      </h2>
      <p className="mt-4 max-w-[52ch] text-base text-text-muted">
        We would rather you hear it here than find it in production.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 border-t border-border pt-10 md:grid-cols-2">
        {ITEMS.map((item, i) => (
          <motion.div key={item.title} {...revealUpStagger(i)}>
            <h3 className="text-base font-medium text-text">{item.title}</h3>
            <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-text-muted">{item.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
