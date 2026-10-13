"use client";

import { motion, useReducedMotion } from "motion/react";
import { HeroScene } from "./HeroScene";
import { EASE_OUT_STRONG } from "@/lib/motion";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="top" className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden pt-24 lg:justify-start">
      <div className="pointer-events-none absolute inset-0">
        <HeroScene />
      </div>
      <HudPill label="Attestation valid" className="right-[6%] top-[32%] hidden lg:flex" delay={0.5} />
      <HudPill label="Revoked in ~800ms" className="bottom-[26%] right-[10%] hidden lg:flex" delay={0.7} />

      <div className="relative mx-auto w-full max-w-3xl px-6 text-center lg:mx-0 lg:max-w-2xl lg:pl-[5%] lg:text-left 2xl:max-w-4xl">
        <motion.h1
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_STRONG }}
          className="display-heading text-3xl text-text sm:text-5xl md:text-6xl lg:text-4xl xl:text-5xl 2xl:text-6xl"
        >
          A kill switch for spending AI agents.
        </motion.h1>

        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: EASE_OUT_STRONG }}
          className="mx-auto mt-6 max-w-[48ch] text-base text-text-muted md:text-lg lg:mx-0"
        >
          Revoke a leaked agent key in under a second. Block payments to counterparties with no
          real settlement history.
        </motion.p>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease: EASE_OUT_STRONG }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start"
        >
          <a
            href="#how-it-works"
            className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            See how it works
          </a>
          <a
            href="https://testnet.monadscan.com/address/0xFB33423DA354A256d95EaC40305422526D2fEdc5"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border-strong px-6 py-3 text-sm text-text transition-all duration-150 ease-out hover:border-accent hover:text-accent active:scale-[0.97]"
          >
            Verify on Monad
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function HudPill({ label, className, delay }: { label: string; className: string; delay: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE_OUT_STRONG }}
      className={`pointer-events-none absolute z-10 items-center gap-2 border border-border-strong bg-bg/70 px-3 py-1.5 font-mono text-xs text-text backdrop-blur-sm ${className}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
      {label}
    </motion.div>
  );
}
