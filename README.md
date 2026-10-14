# Reins

**A kill switch for spending AI agents.**

Reins is a passkey-rooted spending leash and a settlement-verified counterparty gate for autonomous AI agents, deployed live on Monad Testnet (chain ID 10143). An owner sets exactly how much an agent may spend, who it may pay, and for how long. One passkey assertion revokes it from the next block on.

Built for the Monad Metropolis hackathon, Track 04: Trust, Identity and AI Infrastructure.

---

## Table of contents

1. [The idea](#1-the-idea)
2. [The problem](#2-the-problem)
3. [How Reins works](#3-how-reins-works)
4. [Architecture](#4-architecture)
5. [Sequence diagram: setting a spending policy](#5-sequence-diagram-setting-a-spending-policy)
6. [Flow diagrams](#6-flow-diagrams)
7. [Live deployment on Monad Testnet](#7-live-deployment-on-monad-testnet)
8. [Repository structure](#8-repository-structure)
9. [Tech stack](#9-tech-stack)
10. [Running it locally](#10-running-it-locally)
11. [How to use the app](#11-how-to-use-the-app)
12. [API reference](#12-api-reference)
13. [What Reins does not do](#13-what-reins-does-not-do)
14. [Hackathon fit](#14-hackathon-fit)

---

## 1. The idea

AI agents increasingly pay for things on their own: API calls, data, compute, subscriptions. To do that they hold a key. Today that key is almost always a long-lived secret with no spending ceiling, no expiry, and no way to prove, after the fact, whether it was still supposed to be valid when it paid.

Reins separates two things that are usually welded together:

- **Who controls the agent's authority.** The human owner, through a single passkey (Face ID, Touch ID, Windows Hello, or a security key). No seed phrase, no password, no private key stored anywhere.
- **Who the agent can pay.** Only counterparties with real, verifiable payment history, or a small probation allowance for brand-new ones.

Every rule is enforced on-chain by a smart contract account, not by a server that could be bypassed. The agent holds a key that can *spend within limits* but can never raise its own limits, never extend its own expiry, and never un-revoke itself.

### The one-sentence version

> The owner's passkey is the only thing that can widen or end an agent's authority, and the contract refuses to pay anyone with no real settlement history.

---

## 2. The problem

Two failures sit underneath every agent payment, and they share one root cause: nothing is provable, everything is self-reported.

| Failure | Evidence |
|---|---|
| **Keys leak, and stay leaked.** | GitGuardian found **1,275,105** AI-service secrets exposed on public GitHub in 2025 alone. 64% of secrets leaked back in 2022 are still active and exploitable today. |
| **Key compromise costs billions.** | **$2.37B** was lost to crypto hacks in H1 2025 across 121 disclosed incidents (SlowMist). **$1.64B** was lost in Q1 2025 alone, the worst quarter on record (Immunefi). |
| **The trust layer is gameable.** | A live empirical study of ERC-8004's reputation extension found **0 valid** feedback entries after filtering Sybil activity (Xiong et al., 2026). Feedback is rarely grounded in real transactions and is cheap to fake. |

A human notices unusual account activity. An autonomous agent does not, by design: it keeps calling `pay()` until something external stops it. The industry's answer so far has been bigger wallets and longer-lived keys, which only raises the blast radius of the next leak.

---

## 3. How Reins works

Reins has two cooperating halves.

### The spending leash

Each owner deploys one **ReinsAccount**, a smart contract account whose owner key is a passkey's P256 public key. The owner signs a **policy** for each agent key:

| Field | Meaning |
|---|---|
| `perPaymentCap` | The most any single payment may be |
| `dailyCap` | The most the agent may spend in a UTC day |
| `expiry` | A unix timestamp after which the policy is dead |
| `minSettlementAmount` / `minDistinctPayers` | Thresholds a counterparty must meet to be trusted |
| `probationCap` | A small allowance for a counterparty with no history yet |
| `externalOracle` | Optional, disclosed Tier 2 oracle for unknown counterparties |

The policy is authorized by a WebAuthn assertion that the contract verifies on-chain through Monad's **P256 precompile** (EIP-7951, address `0x0100`). The agent key itself has no code path to change any of it.

### The settlement gate

Before any payment moves, the contract asks the **SettlementGate** whether the payee is trustworthy. There is no rating, no voting, and no vouching. The only inputs are real, cleared payments recorded in the **ReceiptBook**:

- **Tier 1, native score.** Computed from the payee's own history of real settlements through Reins. Anyone can recompute it from public events.
- **Tier 2, external oracle.** Opt-in, swappable, disclosed, and only used when a payee has never transacted through Reins before.
- **Probation cap.** A payee with no history can still receive a small trial payment, so a brand-new honest counterparty is not locked out forever.

### Attestations

Every cleared payment issues an **attestation**. Anyone can later ask the **Attestor** contract whether it is still valid. The answer re-checks live state through the issuing account, so a revoked agent shows up as invalid immediately, not as a stale flag.

### One passkey, two keys

A single passkey creation ceremony requests the WebAuthn PRF extension alongside the normal P256 registration. That one user-verification prompt produces both:

1. The **owner key**, a P256 public key, which controls policy and revocation.
2. A 32-byte **PRF output**, which [Mera](https://mera.category.xyz) feeds through standard BIP-44 derivation to produce the agent's own secp256k1 spending key.

The agent key is re-derivable on any device that has the passkey. It is never stored, never uploaded, and never leaves the browser.

---

## 4. Architecture

```
 ┌────────────────────────────── BROWSER ──────────────────────────────┐
 │                                                                      │
 │   Next.js app  (/app)                                                │
 │     │                                                                │
 │     ├─ WebAuthn + Mera ──▶ derives owner key + agent key(s)           │
 │     │                      from ONE passkey                           │
 │     │                                                                │
 │     └─ wagmi + viem ─────▶ MetaMask signs and broadcasts every tx     │
 │                                                                      │
 └───────────────────────────────────┬──────────────────────────────────┘
                                     │ REST: challenges, raw calldata
                                     ▼
 ┌──────────────────────── BACKEND  (Express + viem) ───────────────────┐
 │  builds mandate digests, WebAuthn challenges, and encoded calldata    │
 │  holds no private key  ·  never broadcasts a transaction              │
 └──────────────┬─────────────────────────────────────┬─────────────────┘
                │ reads chain state                   │ GraphQL
                ▼                                     ▼
 ┌──────────────────────────────────┐      ┌─────────────────────────────────┐
 │        MONAD TESTNET (10143)       │      │        ENVIO HYPERINDEX          │
 │                                    │ logs │                                  │
 │  ReinsAccountFactory               │─────▶│  indexes every Reins event       │
 │  ReinsAccount   (one per owner)    │      │  powers /app/feed and the        │
 │  ReceiptBook                       │      │  at-risk meter                   │
 │  Attestor                          │      └─────────────────────────────────┘
 │  SettlementGate                    │
 │  ERC-8004 Identity Registry        │
 │  P256 precompile @ 0x0100          │
 └──────────────────────────────────┘
```

Two design rules run through the whole system:

- **The backend never holds a key and never broadcasts.** It only returns data: a challenge to sign, or calldata to send. Every transaction is signed by the owner's own wallet.
- **The chain is the source of truth.** The backend and indexer only read it. If either disappears, the contracts keep enforcing every rule.

---

## 5. Sequence diagram: setting a spending policy

This is the most important flow: the owner authorizes an agent's limits with a passkey, and the contract verifies that authorization on-chain.

```
Owner              Frontend (/app)          Backend API              Monad
  |                     |                        |                     |
  | 1. fill policy form |                        |                     |
  |-------------------->|                        |                     |
  |                     | 2. POST /policy/build-request                |
  |                     |----------------------->|                     |
  |                     |                        | 3. read nonce +     |
  |                     |                        |    current block    |
  |                     |                        |-------------------->|
  |                     |                        |<--------------------|
  |                     |<-----------------------|                     |
  |                     | 4. { challenge, nonce, validBeforeBlock }    |
  |                     |                        |                     |
  | 5. passkey prompt   |                        |                     |
  |<--------------------|                        |                     |
  | 6. Face ID / PIN    |                        |                     |
  |-------------------->|                        |                     |
  |                     | 7. POST /policy/encode-tx (assertion)        |
  |                     |----------------------->|                     |
  |                     |<-----------------------|                     |
  |                     | 8. { to, data }        |                     |
  |                     |                        |                     |
  |                     | 9. MetaMask signs and sends the transaction  |
  |                     |--------------------------------------------->|
  |                     |                        |  10. setPolicy()    |
  |                     |                        |      verifies the   |
  |                     |                        |      P256 signature |
  |                     |                        |      via 0x0100     |
  |                     |<---------------------------------------------|
  | 11. policy is live  |                        |                     |
  |<--------------------|                        |                     |
```

Revocation (`pullReins`) follows the exact same shape: build a challenge, sign it with the passkey, encode the calldata, send it with the wallet.

---

## 6. Flow diagrams

### 6.1 Four stops, one passkey

```
   01 STAKE            02 GUARD             03 ATTEST            04 REVOKE
 ┌─────────────┐     ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
 │   Derive    │     │    pay()    │      │    Prove    │      │    Kill     │
 │             │     │             │      │             │      │             │
 │ one passkey │────▶│ policy and  │─────▶│ a signed    │─────▶│ one passkey │
 │ gives the   │     │ settlement  │      │ statement,  │      │ assertion   │
 │ owner key   │     │ gate are    │      │ checkable   │      │ ends the    │
 │ AND the     │     │ checked     │      │ by anyone   │      │ agent from  │
 │ agent key   │     │ before any  │      │ against     │      │ the next    │
 │             │     │ value moves │      │ live state  │      │ block on    │
 └─────────────┘     └─────────────┘      └─────────────┘      └─────────────┘
```

### 6.2 One passkey, two keys

```
                    ┌───────────────────────────────┐
                    │      One WebAuthn passkey      │
                    │ Face ID / Touch ID / Hello / key│
                    └───────────────┬───────────────┘
                                    │  one ceremony, one prompt
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
     ┌─────────────────────────┐        ┌───────────────────────────────┐
     │     P256 public key      │        │   PRF extension output         │
     │      (secp256r1)         │        │   32 bytes, deterministic      │
     └────────────┬────────────┘        └───────────────┬───────────────┘
                  │                                     │
                  ▼                                     ▼
     ┌─────────────────────────┐        ┌───────────────────────────────┐
     │       OWNER KEY          │        │   BIP-44 derivation (Mera)     │
     │  controls policy and     │        │   m/44'/60'/0'/0/{index}       │
     │  revocation, verified    │        └───────────────┬───────────────┘
     │  on-chain via 0x0100     │                        ▼
     └─────────────────────────┘        ┌───────────────────────────────┐
                                         │   AGENT KEYS  (secp256k1)      │
                                         │   agent #0, agent #1, #2 ...   │
                                         │   each leashed and revoked     │
                                         │   independently                │
                                         └───────────────────────────────┘
```

### 6.3 What happens when an agent calls `pay()`

```
                           agent calls pay(payee, amount, category)
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │ policy exists, active, │── no ──▶ BLOCK  "Revoked"
                              │ not expired?           │
                              └───────────┬───────────┘
                                          │ yes
                                          ▼
                              ┌───────────────────────┐
                              │ within per-payment cap │── no ──▶ BLOCK
                              │ and daily cap?         │
                              └───────────┬───────────┘
                                          │ yes
                                          ▼
                              ┌───────────────────────┐
                              │   SettlementGate       │
                              │   evaluate(payee)      │
                              └───────────┬───────────┘
                                          │
                  ┌───────────────────────┼────────────────────────┐
                  ▼                       ▼                        ▼
        payee has history        payee has no history       payee has no history
        meets thresholds         + oracle configured        + no oracle
                  │                       │                        │
                  ▼                       ▼                        ▼
               CLEAR              oracle says trusted?       amount <= probationCap?
                                     yes │     no                yes │      no
                                         ▼      ▼                    ▼       ▼
                                      CLEAR   BLOCK              CLEAR    BLOCK

  CLEAR  ──▶ value moves, ReceiptBook records it, Attestor issues an attestation
  BLOCK  ──▶ nothing moves, PaymentBlocked event records the reason
```

### 6.4 Lifecycle of an account

```
  ┌───────────┐   createAccount()   ┌───────────┐   setPolicy()   ┌───────────┐
  │  no       │────────────────────▶│  account   │───────────────▶│  agent    │
  │  account  │  (passkey pubkey)   │  deployed  │  (passkey sig)  │  active   │
  └───────────┘                     └───────────┘                 └─────┬─────┘
                                                                         │
                                       pay() calls, caps and gate apply  │
                                                                         ▼
                                                                  ┌───────────┐
                                                                  │  agent    │
                                                                  │  paused   │
                                                                  └─────┬─────┘
                                                                        ▲
                                          pullReins() (passkey sig)  ───┘
                                          one agent, or every agent

  setPolicy() on a revoked agent writes a fresh, active policy for that key.
```

### 6.5 Where the data on screen comes from

```
   ┌──────────────────────────┐          ┌─────────────────────────────────┐
   │  Reads straight from chain │          │  Reads from the Envio indexer    │
   ├──────────────────────────┤          ├─────────────────────────────────┤
   │ /app  accounts list        │          │ /app/feed   live event stream    │
   │ /app  policy status        │          │ landing page: payments cleared   │
   │ /app/attestations          │          │              and blocked counters │
   │ /app/identity lookups      │          │ at-risk meter and blocked ratio   │
   │ landing page: chain + block│          └─────────────────────────────────┘
   └──────────────────────────┘
```

---

## 7. Live deployment on Monad Testnet

Chain ID **10143**. Every contract below is live.

| Contract | Address | Deployment tx |
|---|---|---|
| ReceiptBook | `0x1bD4f7B31Ced5c603790940eecF2Df550333AD0e` | `0xcf8684c2ba9d75ca48b926edf04ac9f1f67b66bd29304cc004c56a32ad3d8037` |
| Attestor | `0x686721DcA024BC2d6616BB62338023F2Ca8c912f` | `0x861669f3435d8729dfa81a2acea8de10186a50dde741daabaac345a2b0f17b11` |
| SettlementGate | `0xE97c9Cc49460b312FCE3A67682414E5f348F1281` | `0xdb302546895100d1babdf535251e91601823858e0e521a5191fd23b72b81c1f5` |
| ReinsAccountFactory | `0xFB33423DA354A256d95EaC40305422526D2fEdc5` | `0x680ada158aa306905ac2168c34fabd52a9492b0e57153c2342bb7143cfd517cb` |
| ERC-8004 Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | pre-existing public deployment |

### One account's real lifecycle

Three real, signed transactions on a single test account:

| Step | Tx hash | Block | Function |
|---|---|---|---|
| Create account | `0xccb39fd16a57e77b84c9b2465fe9d47713a43c859a8ebe27196fec1b43876786` | 70452598 | `createAccount` |
| Set policy | `0x709948c58d2e10a5824c003e2804ed858c13c654c0198f353dac552ed3853563` | 70453030 | `setPolicy` |
| Pull the reins | `0xeb56916ef6660d2f41b436a453c2a105a1236293b54e391434983c0cdc14dff5` | 70454806 | `pullReins` |

Account `0xFeb5596879be7c865E9122A647aBf6a81388ae6a`, agent key `0xa5671746E0938A90B4E960Dc8F5F3e6157c5e29b`. The agent key was derived in-browser from one passkey via Mera and never stored.

Verify any of these on the explorer: `https://testnet.monadscan.com/tx/<hash>`.

---

## 8. Repository structure

```
.
├── contracts/                    Foundry project (Solidity)
│   └── src/
│       ├── ReinsAccount.sol        per-owner account: policy, pay(), pullReins()
│       ├── ReceiptBook.sol         records every cleared payment
│       ├── Attestor.sol            issues and re-verifies attestations
│       ├── SettlementGate.sol      Tier 1 / Tier 2 / probation decision
│       ├── factory/
│       │   └── ReinsAccountFactory.sol
│       ├── interfaces/             IAttestor, IReceiptBook, IReinsAccount, ...
│       └── libraries/
│           └── WebAuthnP256.sol    on-chain WebAuthn verification (P256 precompile)
│
├── backend/                      Express + viem API (TypeScript)
│   ├── src/
│   │   ├── api/                    app.ts, routes/, validation/
│   │   ├── services/               policy, pullReins, attestation, dashboard, ...
│   │   ├── domain/                 mandate digest + challenge construction
│   │   ├── webauthn/               buildAssertion (server-side test harness only)
│   │   ├── chain/                  viem client, ABIs, addresses
│   │   └── config/                 zod-validated env
│   ├── scripts/
│   │   └── procurement-agent.ts    scripted end-to-end agent demo
│   └── test/                       vitest integration tests
│
├── frontend/                     Next.js app
│   └── src/
│       ├── app/                    / (landing), /app, /app/identity,
│       │                           /app/feed, /app/attestations
│       ├── components/             landing sections, app forms, react-bits ports
│       └── lib/                    webauthn.ts (passkey + Mera), reins.ts (API client)
│
├── indexer/                      Envio HyperIndex
│   ├── config.yaml                 contracts and events to index
│   ├── schema.graphql              entities + the GlobalStats aggregate
│   └── src/handlers/               factory, reinsAccount, attestor, receiptBook
│
├── README.md
├── FEEDBACK.md                   sponsor-technology feedback for the judges
└── Reins_v4_PRD.md               product requirements document
```

---

## 9. Tech stack

| Layer | Technology | Role |
|---|---|---|
| Chain | **Monad Testnet** | Settlement layer. P256/secp256r1 precompile (EIP-7951, `0x0100`) verifies passkey signatures on-chain |
| Contracts | Solidity, Foundry | `ReinsAccount`, `ReceiptBook`, `Attestor`, `SettlementGate`, `ReinsAccountFactory` |
| Owner auth | **WebAuthn passkeys** | Face ID, Touch ID, Windows Hello, or a security key. No seed phrase |
| Agent keys | **Mera** (`@category-labs/mera`) | WebAuthn PRF output, BIP-44 derivation to the agent's secp256k1 key |
| Agent identity | **ERC-8004** | Identity registry, registered directly by the agent's own key |
| Indexing | **Envio HyperIndex** | Live cross-account event feed and the at-risk meter |
| Wallet | **MetaMask** via wagmi + viem | Signs and broadcasts every owner transaction |
| WebAuthn glue | `ox` | Lower-level credential creation with the PRF extension passed through |
| Backend | Node, Express, viem, zod | Builds challenges and calldata. Holds no key |
| Frontend | Next.js, React, Tailwind, Motion, react-three-fiber | Landing page and the `/app` dashboard |
| Data fetching | TanStack Query | Accounts and policy reads |

---

## 10. Running it locally

### Prerequisites

- Node.js 22 or newer
- [Foundry](https://book.getfoundry.sh/) (only to redeploy contracts)
- MetaMask (or any EIP-1193 browser wallet) with some Monad Testnet MON for gas
- A browser with passkey support. For the Mera PRF extension, Chrome with passkeys saved to Google Password Manager is the most reliable desktop option
- Docker, plus **WSL 2 on Windows**, only if you want to run the Envio indexer locally (Envio does not run natively on Windows)

### 1. Contracts (optional, already deployed)

The contracts are already live at the addresses above. To redeploy your own:

```bash
cd contracts
forge build
forge script script/Deploy.s.sol:Deploy --rpc-url https://testnet-rpc.monad.xyz --broadcast
```

Copy the logged addresses into the backend `.env`.

### 2. Backend

```bash
cd backend
cp .env.example .env
# fill in RECEIPT_BOOK_ADDRESS, ATTESTOR_ADDRESS, SETTLEMENT_GATE_ADDRESS,
# FACTORY_ADDRESS (the live addresses are in section 7) and, optionally,
# ENVIO_GRAPHQL_ENDPOINT
npm install
npm run dev          # http://127.0.0.1:8080
npm test             # integration tests
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Use **`localhost`**, not `127.0.0.1`. WebAuthn passkeys are scoped to the exact hostname they were created under, and the dev server only allows those two origins.

The frontend reads the API from `NEXT_PUBLIC_API_URL`, defaulting to `http://127.0.0.1:8080`.

### 4. Indexer (optional, powers `/app/feed` and the at-risk meter)

```bash
cd indexer
npm install
npx envio dev        # needs Docker running; on Windows, run it inside WSL 2
```

Point the backend at the resulting GraphQL endpoint with `ENVIO_GRAPHQL_ENDPOINT`. Without it, the dashboard routes return a clear "not configured" error rather than fake numbers.

### 5. The scripted agent demo (no browser needed)

```bash
cd backend
npm run agent:procurement
```

Runs a full headless lifecycle against the live contracts: deploy an account, set a policy, attempt payments that clear and payments that get blocked, then pull the reins.

---

## 11. How to use the app

Open `http://localhost:3000` and click **Launch app**.

### Step 1. Connect a wallet

Click **Connect wallet**. If your wallet is on another network the button changes to **Switch to Monad Testnet**. If the automatic switch fails, add the network manually:

| Field | Value |
|---|---|
| RPC URL | `https://testnet-rpc.monad.xyz` |
| Chain ID | `10143` |
| Currency symbol | `MON` |
| Explorer | `https://testnet.monadscan.com` |

Your wallet only pays gas and signs transactions. It is the *deployer on record*, nothing more. The passkey is what controls the account.

### Step 2. Create an account

On the **Account** page, give your passkey a label and click **Create passkey + account**.

1. Your device asks you to create a passkey. Choose **this device** (Windows Hello, Touch ID, Chrome's password manager). Do not choose a phone or QR option.
2. Approve the transaction in your wallet.
3. When the transaction confirms, a new address appears under **Your accounts** and is selected automatically.

The agent's key is derived from the same passkey in the same ceremony. You do not create or paste it.

### Step 3. Set a spending policy

With your account selected, find the **Set spending policy** card.

- **Agent key** is already filled in with the key derived from your passkey. Click *Derive another agent key* to mint additional ones (agent #1, #2, and so on), each independently leashed.
- Adjust the caps and expiry. Defaults: 0.1 MON per payment, 1 MON per day, 0.05 MON probation cap, 30 days.
- Leave the two settlement thresholds at `0` to turn the gate off, or raise them to require counterparties to have real payment history.

Click **Sign & set policy**. You are prompted for your passkey (to sign the mandate), then your wallet (to send the transaction). A line `Policy set, tx 0x...` confirms it, and the **Look up a policy by agent key** box fills itself in with the live on-chain policy.

### Step 4. Pull the reins

In the **Pull the reins** card, either enter one agent key or tick **Revoke every agent under this account**, then click **Pull the reins**. Same two prompts: passkey, then wallet. The agent can no longer spend from the next block on.

Setting a fresh policy for a revoked key brings it back to life.

### Step 5. Verify an attestation

Open **Verify attestation**, enter an attestation ID, and click **Verify**. No wallet and no account needed. The result re-checks live chain state: *Valid* if the issuing agent's authority still holds, *Invalid* with a reason (for example *Revoked*) if it does not.

### Step 6. Watch the live feed

**Live feed** streams every policy change, payment, block, revocation, and attestation across every Reins account, indexed by Envio, refreshing every 10 seconds.

### Step 7. Register an agent identity (optional)

**Agent identity** talks directly to the public ERC-8004 registry. Registration is sent by the *agent's own* key, so connect the agent's wallet rather than the owner wallet. You can register an agent URI, set agent metadata, and look up any agent's wallet and metadata by ID.

### Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "No passkey available" or a QR code on your phone | The passkey was saved to a phone, or you are on a different hostname than at creation. Use **this device**, and always the same `localhost` hostname |
| `PRF_UNAVAILABLE` | Your authenticator does not support the WebAuthn PRF extension. On desktop Chrome, save passkeys to Google Password Manager (`chrome://settings/passkeys`) and create a fresh account |
| Wallet crashes on "Switch network" | Add Monad Testnet manually (table above), then switch |
| Feed says "No events yet" | The Envio indexer is not running or not synced. Start it (section 10) |
| Policy lookup is empty | Type or select the exact agent key you set the policy for |

---

## 12. API reference

All routes return JSON. Large integers are strings. The backend never signs or broadcasts.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/chain/info` | Chain ID, current block, deployed addresses |
| POST | `/accounts/create-tx` | Calldata for `createAccount(pubKeyX, pubKeyY)` |
| GET | `/accounts/:creator` | Accounts deployed by a wallet |
| POST | `/policy/build-request` | Mandate digest and WebAuthn challenge for `setPolicy` |
| POST | `/policy/encode-tx` | Calldata for `setPolicy` given a signed assertion |
| GET | `/policy/:account/:agentKey` | Live policy state |
| POST | `/pull-reins/build-request` | WebAuthn challenge for `pullReins` |
| POST | `/pull-reins/encode-tx` | Calldata for `pullReins` given a signed assertion |
| GET | `/settlement/:payee/score` | A payee's total received and distinct payers |
| POST | `/settlement/preview` | Dry-run what the settlement gate would decide |
| GET | `/attestations/:id/verify` | Public attestation verification |
| POST | `/identity/register-tx` | Calldata for ERC-8004 `register` |
| POST | `/identity/set-metadata-tx` | Calldata for ERC-8004 `setMetadata` |
| GET | `/identity/:agentId/wallet` | Agent's registered wallet |
| GET | `/identity/:agentId/metadata?key=` | Agent metadata value |
| GET | `/dashboard/feed?limit=` | Merged event feed from Envio |
| GET | `/dashboard/at-risk-meter` | Cleared and blocked totals from Envio |

---

## 13. What Reins does not do

We would rather you hear it here than find it in production.

- **Cold start looks like fraud.** A brand-new, honest counterparty has zero settlement history and is indistinguishable at first glance from a scam. The probation cap allows a small trial payment instead of an outright block. It is a mitigation, not a full fix.
- **Tier 2 is a vendor dependency, on purpose.** An external oracle is one company's server for that one check. It is opt-in, swappable, and never the only gate, but it is not neutral the way Reins' own attestation is.
- **A compromised passkey still spends within its last policy.** Revocation stops a leaked key going forward. It does not undo what that key was already allowed to do before the reins were pulled.
- **Recovery after a bad payment clears is not solved yet.** Reins prevents and reveals. It does not yet reverse. A flagged-payment hold is on the roadmap, not in this build.
- **Passkey and PRF support varies by device.** Agent-key derivation depends on the authenticator supporting the WebAuthn PRF extension. See [`FEEDBACK.md`](./FEEDBACK.md).

---

## 14. Hackathon fit

Built for **Track 04: Trust, Identity and AI Infrastructure**, which names two of the things Reins is built on: passkey-native accounts using P256 and WebAuthn with no seed phrase, and agent identity under ERC-8004.

Sponsor integrations that drive real features (full write-ups in [`bounty-submissions.txt`](./bounty-submissions.txt)):

- **Mera** derives every agent key from the owner's passkey, and mints additional keys on demand.
- **Envio HyperIndex** powers the live cross-account feed and the at-risk meter.
- **MetaMask** signs and broadcasts every owner action through wagmi and viem.

Sponsor-technology feedback, including a concrete pain point we hit and the fix we propose, is in [`FEEDBACK.md`](./FEEDBACK.md).
