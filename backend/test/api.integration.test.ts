import { describe, it, expect, beforeAll } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/api/app.js";
import { createWalletClient, http, defineChain, zeroAddress, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient } from "../src/chain/client.js";
import { ReinsAccountFactoryAbi } from "../src/chain/abiIndex.js";
import { addresses } from "../src/chain/addresses.js";
import { env } from "../src/config/env.js";
import { p256 } from "@noble/curves/nist.js";

/// Integration tests against whatever REAL chain backend/.env points at —
/// no mocked chain calls anywhere in this file. The read-only tests below
/// work against any network. The write-based "account + policy lifecycle"
/// block additionally needs a funded signer, so it only runs against
/// local anvil's well-known deterministic test key (chain id 31337) —
/// never against a real network, where that key has no funds and
/// shouldn't be used anyway. Local setup:
///   anvil --port 8545 --hardfork osaka
///   (then deploy with forge script, matching backend/.env)
const IS_LOCAL_ANVIL = env.MONAD_CHAIN_ID === 31337;

let server: Server;
let baseUrl: string;

const anvil = defineChain({
  id: 31337,
  name: "anvil",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

const deployerAccount = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
);
const walletClient = createWalletClient({ chain: anvil, transport: http(), account: deployerAccount });

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const port = (server.address() as { port: number }).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function get(path: string): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, json: await res.json() };
}

describe("health and chain info", () => {
  it("GET /health returns ok", async () => {
    const { status, json } = await get("/health");
    expect(status).toBe(200);
    expect(json).toEqual({ status: "ok" });
  });

  it("GET /chain/info reflects the real connected chain", async () => {
    const { json } = await get("/chain/info");
    expect(json.chainId).toBe(env.MONAD_CHAIN_ID);
    expect(json.addresses.factory).toBe(addresses.factory);
  });
});

describe.skipIf(!IS_LOCAL_ANVIL)("account + policy lifecycle against real contracts", () => {
  let newAccount: `0x${string}`;
  const ownerPriv = p256.utils.randomSecretKey();
  const pub = p256.getPublicKey(ownerPriv, false);
  const ownerX = BigInt("0x" + Buffer.from(pub.slice(1, 33)).toString("hex"));
  const ownerY = BigInt("0x" + Buffer.from(pub.slice(33, 65)).toString("hex"));
  const agentKey = "0x4444444444444444444444444444444444444444" as const;

  it("creates a real ReinsAccount via the factory", async () => {
    const hash = await walletClient.writeContract({
      address: addresses.factory,
      abi: ReinsAccountFactoryAbi,
      functionName: "createAccount",
      args: [ownerX, ownerY],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    const log = receipt.logs.find((l) => l.address.toLowerCase() === addresses.factory.toLowerCase());
    expect(log).toBeDefined();
    newAccount = `0x${log!.topics[2]!.slice(26)}`;
    expect(newAccount).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("GET /policy/:account/:agentKey shows no policy yet", async () => {
    const { json } = await get(`/policy/${newAccount}/${agentKey}`);
    expect(json.exists).toBe(false);
  });

  it("POST /policy/build-request returns a mandate digest matching the contract's own computation", async () => {
    const categoryHash = keccak256(toBytes("ads"));
    const { json } = await post("/policy/build-request", {
      account: newAccount,
      agentKey,
      params: {
        perPaymentCap: "1000000000000000000",
        dailyCap: "5000000000000000000",
        expiry: "99999999999",
        minSettlementAmount: "0",
        minDistinctPayers: 0,
        probationCap: "0",
        externalOracle: zeroAddress,
        categories: [categoryHash],
      },
    });

    expect(json.nonce).toBe("0");
    expect(json.mandateDigest).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(json.challenge).toMatch(/^0x/);
  });
});

describe("settlement + attestation read endpoints against real contracts", () => {
  it("GET /settlement/:payee/score returns zero history for an untouched address", async () => {
    const { json } = await get("/settlement/0x5555555555555555555555555555555555555555/score");
    expect(json.totalReceived).toBe("0");
    expect(json.distinctPayers).toBe("0");
  });

  it("POST /settlement/preview blocks a payment with no settlement history and no probation cap", async () => {
    const { json } = await post("/settlement/preview", {
      payee: "0x5555555555555555555555555555555555555555",
      amount: "1000000000000000000",
      minSettlementAmount: "1",
      minDistinctPayers: 0,
      probationCap: "0",
    });
    expect(json.allowed).toBe(false);
    expect(json.reason).toBe("SettlementUnverified");
  });

  it("POST /settlement/preview allows a payment under the probation cap", async () => {
    const { json } = await post("/settlement/preview", {
      payee: "0x5555555555555555555555555555555555555555",
      amount: "100",
      minSettlementAmount: "1",
      minDistinctPayers: 0,
      probationCap: "1000",
    });
    expect(json.allowed).toBe(true);
    expect(json.reason).toBe("ProbationCap");
  });

  it("GET /attestations/:id/verify reports NotFound for a nonexistent id", async () => {
    const { json } = await get("/attestations/999999/verify");
    expect(json.valid).toBe(false);
    expect(json.reason).toBe("NotFound");
  });
});

describe.skipIf(!env.ENVIO_GRAPHQL_ENDPOINT)("dashboard (real Envio indexer)", () => {
  it("GET /dashboard/feed returns a well-shaped, timestamp-sorted feed", async () => {
    const { status, json } = await get("/dashboard/feed?limit=5");
    expect(status).toBe(200);
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < json.items.length; i++) {
      expect(Number(json.items[i - 1].timestamp)).toBeGreaterThanOrEqual(Number(json.items[i].timestamp));
    }
  });

  it("GET /dashboard/at-risk-meter returns a consistent blocked ratio", async () => {
    const { status, json } = await get("/dashboard/at-risk-meter");
    expect(status).toBe(200);
    expect(json.blockedRatio).toBeGreaterThanOrEqual(0);
    expect(json.blockedRatio).toBeLessThanOrEqual(1);
  });
});

describe("validation", () => {
  it("rejects a malformed address with 400", async () => {
    const { status, json } = await get("/settlement/not-an-address/score");
    expect(status).toBe(400);
    expect(json.error).toBe("Invalid request");
  });
});
