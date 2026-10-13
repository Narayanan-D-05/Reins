import type { Address, Hex } from "viem";

const keyFor = (account: Address) => `reins:passkey:${account.toLowerCase()}`;
const agentsKeyFor = (account: Address) => `reins:agents:${account.toLowerCase()}`;

export function rememberPasskey(account: Address, credentialId: string) {
  try {
    localStorage.setItem(keyFor(account), credentialId);
  } catch {
    // localStorage unavailable (private browsing, etc.) — the owner can
    // still sign via the browser's own passkey picker, just without the
    // shortcut of skipping it.
  }
}

export function getRememberedPasskey(account: Address): string | undefined {
  try {
    return localStorage.getItem(keyFor(account)) ?? undefined;
  } catch {
    return undefined;
  }
}

export interface RememberedAgent {
  index: number;
  address: Hex;
}

/// Agent addresses are re-derivable from the owner's passkey at any time
/// (see lib/webauthn.ts) — this cache only saves re-prompting the passkey
/// just to redisplay an address the owner has already seen.
export function rememberAgentAddress(account: Address, index: number, address: Hex) {
  try {
    const existing = getRememberedAgents(account).filter((a) => a.index !== index);
    const next = [...existing, { index, address }].sort((a, b) => a.index - b.index);
    localStorage.setItem(agentsKeyFor(account), JSON.stringify(next));
  } catch {
    // Non-fatal — see rememberPasskey above.
  }
}

export function getRememberedAgents(account: Address): RememberedAgent[] {
  try {
    const raw = localStorage.getItem(agentsKeyFor(account));
    return raw ? (JSON.parse(raw) as RememberedAgent[]) : [];
  } catch {
    return [];
  }
}
