import { WebAuthnP256 } from "ox";
import { Registration } from "ox/webauthn";
import { getPasskeyPrfOutput, createSecp256k1SigningSession } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { sha256 } from "@noble/hashes/sha2.js";
import type { Hex } from "viem";

/// Mera's own default PRF salt (sha256("mera.prf.salt.v1")), reproduced here
/// so a single passkey creation ceremony can request the PRF extension
/// itself (via ox's lower-level Registration.create, which passes
/// `extensions` straight through to navigator.credentials.create()) rather
/// than needing a second, Mera-only passkey. Requesting this exact salt
/// keeps the output interchangeable with Mera's own getPasskeyPrfOutput.
const MERA_DEFAULT_PRF_SALT = sha256(new TextEncoder().encode("mera.prf.salt.v1"));

/// BIP-44 derivation from a 32-byte PRF output, exactly as Monad's own Mera
/// integration guide (docs.monad.xyz/guides/mera) specifies — deterministic
/// and re-derivable on any device, as long as the same passkey answers the
/// same PRF evaluation.
function deriveAgentPrivateKey(prfOutput: Uint8Array, index: number): Uint8Array {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  if (!node.privateKey) throw new Error("BIP-44 derivation produced no private key");
  return node.privateKey;
}

function deriveAgentAddress(prfOutput: Uint8Array, index: number): Hex {
  const session = createSecp256k1SigningSession({ privateKey: deriveAgentPrivateKey(prfOutput, index) });
  try {
    return toViemAccount(session).address;
  } finally {
    session.end();
  }
}

function readPrfOutput(raw: { getClientExtensionResults(): unknown }): Uint8Array | undefined {
  const results = raw.getClientExtensionResults() as {
    prf?: { results?: { first?: BufferSource } };
  };
  const first = results.prf?.results?.first;
  if (!first) return undefined;
  return first instanceof Uint8Array ? first : new Uint8Array(first as ArrayBuffer);
}

export interface CreatedPasskey {
  credentialId: string;
  publicKeyX: string;
  publicKeyY: string;
  /// The agent's own EVM signing address, re-derived (never stored) from
  /// this same passkey's PRF output — this is the one passkey the Hero
  /// section promises: it both authorizes the owner's mandates (P256,
  /// below) and roots the agent's spending key (secp256k1, via Mera).
  agentAddress: Hex;
}

/// Creates a real platform passkey (Face ID / Touch ID / Windows Hello /
/// security key) via navigator.credentials.create(), requesting the PRF
/// extension in the same ceremony as the P256 registration. The P256
/// public key goes to ReinsAccountFactory.createAccount as the owner key;
/// the PRF output derives the agent's EVM key via Mera + BIP-44. Neither
/// the backend nor Reins itself ever sees either private key.
export async function createPasskey(label: string): Promise<CreatedPasskey> {
  const rpId = window.location.hostname;

  const credential = await Registration.create({
    rp: { id: rpId, name: "Reins" },
    user: { name: label, displayName: label },
    authenticatorSelection: {
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
      // Keeps the passkey on this device (Chrome's own passkey manager or
      // the OS platform authenticator) instead of offering a QR-code
      // cross-device flow to a phone. The PRF extension (needed below for
      // the Mera-derived agent key) is unreliable over that hybrid
      // transport on most phone/OS combinations even when it works fine
      // for a passkey stored directly on this device.
      authenticatorAttachment: "platform",
    },
    extensions: { prf: { eval: { first: MERA_DEFAULT_PRF_SALT } } },
  });

  // Most authenticators (Google Password Manager, iCloud Keychain,
  // 1Password) return the PRF output on creation itself. A few only
  // *enable* PRF at creation and return the real output on a later
  // assertion — Mera's own getPasskeyPrfOutput covers that fallback,
  // reusing the same credential (one extra user-verification prompt, same
  // passkey, not a second one).
  let prfOutput = readPrfOutput(credential.raw);
  if (!prfOutput) {
    const fallback = await getPasskeyPrfOutput({ rpId, credential: { credentialId: credential.id } });
    prfOutput = fallback.prfOutput;
  }

  return {
    credentialId: credential.id,
    publicKeyX: credential.publicKey.x.toString(),
    publicKeyY: credential.publicKey.y.toString(),
    agentAddress: deriveAgentAddress(prfOutput, 0),
  };
}

/// Re-derives an agent address (any index) from an already-created passkey,
/// for looking an address back up or for owners who want more than one
/// agent under the same account. Prompts the passkey again (a fresh PRF
/// assertion) — no key material is ever persisted anywhere. When
/// `credentialId` isn't known (e.g. a different browser/session than the
/// one that created the account), the browser's own passkey picker is
/// shown instead of silently guessing.
export async function deriveAnotherAgentAddress(index: number, credentialId?: string): Promise<Hex> {
  const { prfOutput } = await getPasskeyPrfOutput({
    rpId: window.location.hostname,
    credential: credentialId ? { credentialId } : undefined,
  });
  return deriveAgentAddress(prfOutput, index);
}

export interface ReinsAssertion {
  authenticatorData: Hex;
  clientDataJSON: string;
  challengeIndex: string;
  typeIndex: string;
  r: string;
  s: string;
}

/// Signs a Reins challenge (from /policy/build-request or
/// /pull-reins/build-request) with the owner's passkey via
/// navigator.credentials.get(), shaped exactly as the backend's
/// WebAuthnAssertion schema expects.
export async function signChallenge(challenge: Hex, credentialId?: string): Promise<ReinsAssertion> {
  const { metadata, signature } = await WebAuthnP256.sign({ challenge, credentialId });
  return {
    authenticatorData: metadata.authenticatorData,
    clientDataJSON: metadata.clientDataJSON,
    challengeIndex: String(metadata.challengeIndex),
    typeIndex: String(metadata.typeIndex),
    r: signature.r.toString(),
    s: signature.s.toString(),
  };
}
