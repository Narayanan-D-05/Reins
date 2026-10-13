"use client";

import { motion } from "motion/react";
import { revealUp } from "@/lib/motion";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-32 text-center md:py-40">
      <motion.h2 {...revealUp} className="display-heading text-3xl text-text md:text-5xl">
        Nobody should need an account with us to check if an agent is still trusted.
      </motion.h2>
      <motion.div
        {...revealUp}
        transition={{ ...revealUp.transition, delay: 0.1 }}
        className="mt-10 flex flex-wrap items-center justify-center gap-4"
      >
        <a
          href="https://testnet.monadscan.com/address/0xFB33423DA354A256d95EaC40305422526D2fEdc5"
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          Verify on Monad
        </a>
      </motion.div>
    </section>
  );
}
