"use client";

import { useScroll, useMotionValueEvent, motion } from "motion/react";
import { useState } from "react";
import Link from "next/link";
import GooeyNav from "@/components/react-bits/GooeyNav";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#settlement-gate", label: "Settlement gate" },
  { href: "#network", label: "Network" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 8);
  });

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <motion.div
        animate={{
          backgroundColor: scrolled ? "rgba(7,10,12,0.78)" : "rgba(7,10,12,0)",
          borderColor: scrolled ? "rgba(237,243,245,0.08)" : "rgba(237,243,245,0)",
        }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="border-b backdrop-blur-xl"
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="#top" className="font-mono text-sm tracking-[0.1em] text-text">
            REINS
          </a>

          <div className="hidden md:block">
            <GooeyNav items={NAV_LINKS} initialActiveIndex={0} />
          </div>

          <Link
            href="/app"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            Launch app
          </Link>
        </nav>
      </motion.div>
    </header>
  );
}
