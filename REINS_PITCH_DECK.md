# Reins — A kill switch for spending AI agents

**Monad Metropolis · Track 04: Trust, Identity & AI Infrastructure**
Passkey-rooted spending leash + settlement-verified counterparty gate, live on Monad Testnet (chain 10143)

---

## The problem, part 1: AI agents run on keys that leak, and stay leaked

**1,275,105** — AI-service secrets exposed on public GitHub in 2025 alone.
64% of secrets leaked back in 2022 are still active and exploitable today. Rotating a key rarely means the leak is actually closed.
*Source: GitGuardian, State of Secrets Sprawl 2026*

A leaked key for a human is bad. For an agent it is worse. A human notices unusual account activity. An autonomous agent does not, by design: it keeps calling `pay()` until something external stops it. The industry's answer so far has been bigger wallets and longer-lived keys, which only raises the blast radius of the next leak.

---

## The problem, part 2: two failures, one root cause

Nothing provable, everything self-reported.

| Stat | What it means | Source |
|---|---|---|
| **$2.37B** | lost to crypto hacks in H1 2025 alone, across 121 disclosed incidents | SlowMist, H1 2025 report |
| **$1.64B** | lost in Q1 2025 alone — the worst quarter for crypto hacks on record | Immunefi, Crypto Losses Q1 2025 |
| **0 valid** | feedback entries left in a live ERC-8004 study after filtering Sybil activity | Xiong et al., 2026 |

Key compromise is already a multi-billion-dollar line item in crypto, and AI agents are the newest class of always-on, unattended key holders. Meanwhile the reputation layer agents are supposed to check before paying a counterparty is cheap to fake and rarely grounded in a real transaction.

---

## The solution: a passkey-rooted spending leash, not a bigger wallet

Reins gives every AI agent an on-chain spending policy that only the owner's passkey can set or revoke, and a settlement gate that only pays counterparties with real, verifiable payment history.

**Spending leash**
- Per-payment and daily caps, enforced on-chain
- Policy expiry, no silent indefinite authority
- Revoked in under a second with one passkey assertion
- The agent key itself can never raise its own caps

**Settlement gate**
- Tier 1: native trust score from real cleared payments
- Tier 2: optional, disclosed external oracle
- Probation cap for a brand-new, unproven counterparty
- No address can rate, vote on, or vouch for anyone

---

## How it works: four stops, one passkey

| Step | What happens |
|---|---|
| **01 Stake — Derive** | One WebAuthn passkey derives the owner key and the agent's own spending key, via Mera, re-derivable on any device. |
| **02 Guard — pay()** | Every agent payment calls `pay()`. The guard checks the spending policy and the settlement gate first, before anything moves. |
| **03 Attest — Prove** | A signed statement, checkable by anyone on Monad. It re-checks live state at verification time, not a frozen flag. |
| **04 Revoke — Kill** | A passkey assertion, verified on-chain via the P256 precompile, kills the agent from the next block on. |

Every step above signs a real transaction on Monad Testnet, live at `/app`.

---

## Technology: built directly on primitives, not wrapped around them

| Layer | What it does here |
|---|---|
| **Monad** | P256 / secp256r1 precompile, EIP-7951, address `0x0100`, verifies passkey signatures on-chain |
| **WebAuthn** | Owner passkey: Face ID, Touch ID, Windows Hello, or a security key. No seed phrase anywhere |
| **Mera** | PRF extension output from the same passkey, BIP-44 derives the agent's own secp256k1 key |
| **ERC-8004** | Agent identity registry, independent of the spending leash, registered by the agent's own key |
| **Envio HyperIndex** | Live cross-account event feed and at-risk meter, indexed straight from chain |
| **Foundry / Solidity** | ReinsAccount, ReceiptBook, Attestor, SettlementGate, ReinsAccountFactory |
| **viem / wagmi / Next.js** | Wallet-connected app at `/app`. Every policy, revoke, and identity action signs a real tx |

---

## Live proof: deployed on Monad Testnet, chain ID 10143

| Contract | Address | Deployment tx |
|---|---|---|
| ReceiptBook | `0x1bD4f7B31Ced5c603790940eecF2Df550333AD0e` | `0xcf8684c2ba9d75ca48b926edf04ac9f1f67b66bd29304cc004c56a32ad3d8037` |
| Attestor | `0x686721DcA024BC2d6616BB62338023F2Ca8c912f` | `0x861669f3435d8729dfa81a2acea8de10186a50dde741daabaac345a2b0f17b11` |
| SettlementGate | `0xE97c9Cc49460b312FCE3A67682414E5f348F1281` | `0xdb302546895100d1babdf535251e91601823858e0e521a5191fd23b72b81c1f5` |
| ReinsAccountFactory | `0xFB33423DA354A256d95EaC40305422526D2fEdc5` | `0x680ada158aa306905ac2168c34fabd52a9492b0e57153c2342bb7143cfd517cb` |

Current block at time of writing: **70,739,314**. Read live, with no account and no API key, at `/app/attestations` and the public dashboard feed.

### One account's real lifecycle

Create, set a policy, pull the reins: three real signed transactions on a single test account.

| Step | Tx hash | Block | Function |
|---|---|---|---|
| Create account | `0xccb39fd16a57e77b84c9b2465fe9d47713a43c859a8ebe27196fec1b43876786` | 70452598 | `createAccount` |
| Set policy | `0x709948c58d2e10a5824c003e2804ed858c13c654c0198f353dac552ed3853563` | 70453030 | `setPolicy` |
| Pull the reins | `0xeb56916ef6660d2f41b436a453c2a105a1236293b54e391434983c0cdc14dff5` | 70454806 | `pullReins` |

Account `0xFeb5596879be7c865E9122A647aBf6a81388ae6a`, agent key `0xa5671746E0938A90B4E960Dc8F5F3e6157c5e29b` — derived in-browser from one passkey via Mera, never stored.

### Public attestation verification (attestation #1)

```json
{
  "valid": false,
  "reason": "Revoked",
  "attestation": {
    "account": "0x547b395af802C033E07356f4613753E74EFFfa45",
    "agentKey": "0x9474183d1e0657eFF26eE9c4d832f7c0CfD2AcAa",
    "mandateDigest": "0x053a260e8946fa37a2dc4efda344eb844c9e4620c40628b21b1f47287b2184f2",
    "receiptId": "1",
    "issuedAtBlock": "69589733"
  }
}
```

Anyone can re-check this live at `/app/attestations`, no account required.

---

## The product: a real site, a real app, not a mockup

- **Landing page** — live network stats pulled directly from the deployed contracts, not mock data
- **`/app`** — connect a wallet, create a passkey, agent key auto-filled from the same passkey, sign a real transaction
- **`/app/attestations`** — public attestation verifier, re-checking live chain state for anyone
- **`/app/feed`** — live cross-account event feed via Envio HyperIndex
- **`/app/identity`** — ERC-8004 agent registration, directly against the public registry

---

## Fit with this hackathon

Built for Track 04, and genuinely integrates four sponsor bounties.

| Prize | Why Reins qualifies |
|---|---|
| **Track 04 — $30,000** | Passkey-native accounts with P256 and WebAuthn, no seed phrase, plus ERC-8004 agent identity: both listed track bullets, built literally |
| **Monad Foundation — "Mera: One Passkey, Many Keys" — $2,500** | One passkey ceremony derives both the owner's P256 key and the agent's secp256k1 key, via Mera's real PRF output and BIP-44 |
| **Monad Foundation — "Best Mera-Powered UX" — $2,500** | Agent keys appear automatically in the policy form, no manual paste, no separate key-management step |
| **MetaMask — "Best Agent Wallet Plugin" — $2,500** | Every owner action — policy, revoke, identity registration — signs and broadcasts through a connected MetaMask wallet |
| **Envio — "Best Use of Envio" — $1,000** | HyperIndex powers the live cross-account event feed and the at-risk meter on `/app/feed` |

---

## What Reins does not do

We would rather you hear it here than find it in production.

- **Cold start looks like fraud.** A brand-new honest counterparty has zero settlement history. The probation cap allows a small trial payment instead of an outright block, not a full fix.
- **Tier 2 is a vendor dependency, on purpose.** An external oracle is one company's server for that one check. It is opt-in and swappable, and never the only gate.
- **A compromised passkey still spends within its last policy.** Revocation stops a leaked key going forward. It does not undo what that key was already allowed to do before the reins were pulled.
- **Recovery after a bad payment clears is not solved yet.** Reins prevents and reveals, it does not yet reverse. A flagged-payment hold is on the roadmap, not in this build.

---

## Closing

> Nobody should need an account with us to check if an agent is still trusted.

Live now, chain 10143
Factory `0xFB33423DA354A256d95EaC40305422526D2fEdc5`
