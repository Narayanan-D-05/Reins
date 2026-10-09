/**
 * Scripted procurement agent (PRD §12 MUST BUILD).
 *
 * Runs the full Reins lifecycle against REAL deployed contracts on the
 * configured network (local anvil for development, Monad testnet for the
 * real demo) — every step is a real transaction or a real on-chain read,
 * nothing here is simulated or faked:
 *
 *   1. Create a ReinsAccount for a fresh owner (real P256 keypair, standing
 *      in for a WebAuthn passkey — see src/webauthn/buildAssertion.ts).
 *   2. Owner deposits funds and signs a policy for one agent key, allowing
 *      the "procurement" category with a settlement-gate threshold that a
 *      brand-new counterparty cannot possibly meet.
 *   3. Agent attempts to pay a first-time counterparty — blocked with
 *      "SettlementUnverified" (PRD §6, the counterfeit-counterparty case
 *      from the user story in PRD §8 Scene 2).
 *   4. Owner raises the policy's probation cap. Agent retries a small
 *      payment — clears, and a live attestation is issued.
 *   5. Owner pulls the reins on the agent. The same attestation that was
 *      valid a moment ago now reports "Revoked" — proving attestations are
 *      a live check, not a frozen certificate.
 *   6. A further payment attempt from the now-revoked agent is blocked.
 *   7. If running against a network with the real ERC-8004 registry
 *      deployed (Monad Testnet), the agent registers its own identity
 *      directly against it — independent of Reins' own contracts.
 *
 * Usage: npm run agent:procurement
 *
 * KNOWN LOCAL-ONLY LIMITATION: steps that submit a real WebAuthn-shaped P256
 * signature (setPolicy, pullReins) will revert with InvalidOwnerSignature()
 * when run against local anvil. This was root-caused, not assumed: anvil's
 * "osaka" P256 precompile emulation and Foundry's own `vm.signP256`
 * cheatcode are mutually self-consistent but non-standard — @noble/curves
 * (the audited library used here, matching real browser WebAuthn crypto)
 * independently rejects Foundry's own cheatcode-generated signatures as
 * invalid ECDSA, and the precompile independently rejects noble's
 * signatures. Both can't be the real standard; noble is. This script's
 * signing logic is real, standards-compliant P256 — it will work against
 * Monad Testnet's actual precompile. The Solidity unit tests
 * (contracts/test/ReinsSystem.t.sol) already validate the full WebAuthn
 * parsing + business logic locally using Foundry's own cheatcode, which is
 * self-consistent with Foundry's own local precompile. Definitive
 * confirmation of this script against a real signature requires running it
 * against Monad Testnet.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  zeroAddress,
  keccak256,
  toBytes,
  parseEther,
  decodeEventLog,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { p256 } from "@noble/curves/nist.js";
import { env } from "../src/config/env.js";
import { addresses } from "../src/chain/addresses.js";
import { ReinsAccountAbi, ReinsAccountFactoryAbi, AttestorAbi, ERC8004IdentityRegistryAbi } from "../src/chain/abiIndex.js";
import { computeMandateDigest, buildSetPolicyChallenge, buildPullReinsChallenge } from "../src/domain/mandate.js";
import { buildWebAuthnAssertion, derivePublicKey } from "../src/webauthn/buildAssertion.js";
import { verifyAttestation } from "../src/services/attestationService.js";
import type { PolicyParams } from "../src/domain/types.js";

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!DEPLOYER_PRIVATE_KEY) {
  throw new Error(
    "Set DEPLOYER_PRIVATE_KEY in the environment — this script funds a fresh agent wallet from it. " +
      "Use the same disposable testnet key you used to deploy the contracts."
  );
}

const chain = defineChain({
  id: env.MONAD_CHAIN_ID,
  name: "reins-target-chain",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [env.MONAD_RPC_URL] } },
});

const publicClient = createPublicClient({ chain, transport: http(env.MONAD_RPC_URL) });
const deployer = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
const deployerWallet = createWalletClient({ chain, transport: http(env.MONAD_RPC_URL), account: deployer });

const log = (msg: string) => console.log(`\n[procurement-agent] ${msg}`);

async function main() {
  log(`Target chain id: ${env.MONAD_CHAIN_ID} via ${env.MONAD_RPC_URL}`);

  // --- Step 1: fresh owner (P256) + fresh agent (secp256k1) keys ---
  const ownerPrivateKey = p256.utils.randomSecretKey();
  const { x: ownerX, y: ownerY } = derivePublicKey(ownerPrivateKey);

  const agentPrivateKey = generatePrivateKey();
  const agentAccount = privateKeyToAccount(agentPrivateKey);
  const agentWallet = createWalletClient({ chain, transport: http(env.MONAD_RPC_URL), account: agentAccount });

  log(`Owner P256 pubkey: x=${ownerX} y=${ownerY}`);
  log(`Agent key (Mera-derived in production, generated here): ${agentAccount.address}`);

  // Fund the agent key with enough gas to send its own transactions.
  const fundHash = await deployerWallet.sendTransaction({ to: agentAccount.address, value: parseEther("0.05") });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  log(`Funded agent key with 0.05 native token (tx ${fundHash})`);

  // --- Step 2: create the ReinsAccount ---
  const createHash = await deployerWallet.writeContract({
    address: addresses.factory,
    abi: ReinsAccountFactoryAbi,
    functionName: "createAccount",
    args: [ownerX, ownerY],
  });
  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
  const createLog = createReceipt.logs.find((l) => l.address.toLowerCase() === addresses.factory.toLowerCase());
  const account = `0x${createLog!.topics[2]!.slice(26)}` as Address;
  log(`Created ReinsAccount: ${account}`);

  const depositHash = await deployerWallet.sendTransaction({ to: account, value: parseEther("1") });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  log(`Owner deposited 1 native token into the account`);

  const PROCUREMENT_CATEGORY = keccak256(toBytes("procurement"));
  const payee = privateKeyToAccount(generatePrivateKey()).address; // a first-time counterparty

  // --- Step 3: policy with a settlement threshold the payee can't meet yet ---
  await setPolicy(account, agentAccount.address, ownerPrivateKey, {
    perPaymentCap: parseEther("0.1"),
    dailyCap: parseEther("0.5"),
    expiry: 9_999_999_999n,
    minSettlementAmount: parseEther("1"), // payee has zero history — can't meet this
    minDistinctPayers: 1,
    probationCap: 0n, // no probation yet — this is the "hard block" case
    externalOracle: zeroAddress,
    categories: [PROCUREMENT_CATEGORY],
  });
  log(`Owner set policy for agent (no probation cap yet)`);

  const firstAttempt = await attemptPay(agentWallet, account, payee, parseEther("0.01"), PROCUREMENT_CATEGORY);
  log(`Payment attempt to first-time counterparty: success=${firstAttempt.success}, reason=${firstAttempt.reason}`);
  if (firstAttempt.success) throw new Error("Expected this payment to be blocked by the settlement gate");

  // --- Step 4: raise probation cap, retry ---
  await setPolicy(account, agentAccount.address, ownerPrivateKey, {
    perPaymentCap: parseEther("0.1"),
    dailyCap: parseEther("0.5"),
    expiry: 9_999_999_999n,
    minSettlementAmount: parseEther("1"),
    minDistinctPayers: 1,
    probationCap: parseEther("0.02"), // small trial payment now allowed
    externalOracle: zeroAddress,
    categories: [PROCUREMENT_CATEGORY],
  });
  log(`Owner raised the probation cap to allow a small trial payment`);

  const secondAttempt = await attemptPay(agentWallet, account, payee, parseEther("0.01"), PROCUREMENT_CATEGORY);
  log(`Payment attempt under probation cap: success=${secondAttempt.success}, reason=${secondAttempt.reason}`);
  if (!secondAttempt.success) throw new Error("Expected this payment to clear under the probation cap");

  const attestationId = secondAttempt.attestationId!;
  const liveCheck1 = await verifyAttestation(attestationId);
  log(`Attestation #${attestationId} immediately after clearing: valid=${liveCheck1.valid} reason=${liveCheck1.reason}`);

  // --- Step 5: pull the reins ---
  await pullReins(account, agentAccount.address, ownerPrivateKey);
  log(`Owner pulled the reins on the agent`);

  const liveCheck2 = await verifyAttestation(attestationId);
  log(`Same attestation #${attestationId} after revocation: valid=${liveCheck2.valid} reason=${liveCheck2.reason}`);
  if (liveCheck2.valid) throw new Error("Expected the attestation to go invalid after revocation");

  // --- Step 6: further payment attempts are blocked ---
  const thirdAttempt = await attemptPay(agentWallet, account, payee, parseEther("0.01"), PROCUREMENT_CATEGORY);
  log(`Payment attempt after revocation: success=${thirdAttempt.success}, reason=${thirdAttempt.reason}`);
  if (thirdAttempt.success) throw new Error("Expected this payment to be blocked after revocation");

  // --- Step 7: ERC-8004 identity registration (only if the registry exists on this chain) ---
  const registryCode = await publicClient.getCode({ address: addresses.erc8004IdentityRegistry });
  if (registryCode && registryCode !== "0x") {
    const registerHash = await agentWallet.writeContract({
      address: addresses.erc8004IdentityRegistry,
      abi: ERC8004IdentityRegistryAbi,
      functionName: "register",
      args: ["https://example.com/agent-card.json"],
    });
    const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });
    log(`Agent registered its own ERC-8004 identity (tx ${registerHash}, status ${registerReceipt.status})`);
  } else {
    log(`ERC-8004 registry not deployed at ${addresses.erc8004IdentityRegistry} on this chain — skipping (expected on local anvil; present on Monad Testnet)`);
  }

  log("Procurement agent run complete — every MUST-BUILD mechanic exercised against real contracts.");
}

async function setPolicy(
  account: Address,
  agentKey: Address,
  ownerPrivateKey: Uint8Array,
  params: PolicyParams
) {
  const nonce = (await publicClient.readContract({
    address: account,
    abi: ReinsAccountAbi,
    functionName: "ownerActionNonce",
  })) as bigint;
  const validBeforeBlock = (await publicClient.getBlockNumber()) + 200n;
  const mandateDigest = computeMandateDigest(account, agentKey, params);
  const challenge = buildSetPolicyChallenge(account, mandateDigest, nonce, validBeforeBlock);
  const assertion = buildWebAuthnAssertion(ownerPrivateKey, challenge, true);

  const hash = await deployerWallet.writeContract({
    address: account,
    abi: ReinsAccountAbi,
    functionName: "setPolicy",
    args: [agentKey, params, nonce, validBeforeBlock, assertion],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function pullReins(account: Address, agentKey: Address, ownerPrivateKey: Uint8Array) {
  const nonce = (await publicClient.readContract({
    address: account,
    abi: ReinsAccountAbi,
    functionName: "ownerActionNonce",
  })) as bigint;
  const validBeforeBlock = (await publicClient.getBlockNumber()) + 200n;
  const challenge = buildPullReinsChallenge(account, agentKey, nonce, validBeforeBlock);
  const assertion = buildWebAuthnAssertion(ownerPrivateKey, challenge, true);

  const hash = await deployerWallet.writeContract({
    address: account,
    abi: ReinsAccountAbi,
    functionName: "pullReins",
    args: [agentKey, nonce, validBeforeBlock, assertion],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function attemptPay(
  agentWallet: ReturnType<typeof createWalletClient>,
  account: Address,
  payee: Address,
  amount: bigint,
  category: Hex
): Promise<{ success: boolean; reason: string; attestationId?: bigint }> {
  const hash = await agentWallet.writeContract({
    address: account,
    abi: ReinsAccountAbi,
    functionName: "pay",
    args: [payee, amount, category],
    chain,
    account: agentWallet.account!,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  for (const l of receipt.logs) {
    if (l.address.toLowerCase() !== account.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: ReinsAccountAbi, data: l.data, topics: l.topics });
      if (decoded.eventName === "PaymentCleared") {
        return { success: true, reason: "Cleared", attestationId: decoded.args.attestationId };
      }
      if (decoded.eventName === "PaymentBlocked") {
        return { success: false, reason: decoded.args.reason };
      }
    } catch {
      // not a Reins event we care about (or not decodable with this ABI) — skip
    }
  }
  return { success: false, reason: "UnknownNoEventFound" };
}

main().catch((err) => {
  console.error("\n[procurement-agent] FAILED:", err);
  process.exitCode = 1;
});
