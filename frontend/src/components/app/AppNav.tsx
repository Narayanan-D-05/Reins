"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWallet } from "./ConnectWallet";

const LINKS = [
  { href: "/app", label: "Account" },
  { href: "/app/identity", label: "Agent identity" },
  { href: "/app/feed", label: "Live feed" },
  { href: "/app/attestations", label: "Verify attestation" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <Link href="/" className="font-mono text-sm tracking-[0.1em] text-text">
        REINS
      </Link>
      <nav className="flex flex-wrap gap-1">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              pathname === link.href
                ? "bg-accent-soft text-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <ConnectWallet />
    </div>
  );
}
