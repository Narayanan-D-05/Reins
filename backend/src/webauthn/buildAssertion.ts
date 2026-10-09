import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { toBytes, bytesToHex, concatHex, type Hex } from "viem";
import type { WebAuthnAssertion } from "../domain/types.js";

/// Builds a real, correctly-signed WebAuthn-shaped assertion over a Reins
/// challenge, matching exactly what WebAuthnP256.sol verifies on-chain:
/// signedHash = sha256(authenticatorData || sha256(clientDataJSON)).
///
/// This exists for contexts with no browser (the scripted procurement
/// agent demo, and any future server-side test harness) — it is real P256
/// cryptography via the audited @noble/curves library, not a mock. In
/// production, this exact signing step happens in the owner's browser via
/// `navigator.credentials.get()` against their actual passkey; a backend
/// server must never hold an owner's P256 private key.
export function buildWebAuthnAssertion(
  ownerPrivateKey: Uint8Array,
  challenge: Hex,
  userVerified: boolean
): WebAuthnAssertion {
  const flags = userVerified ? 0x05 : 0x01;
  const authenticatorData = concatHex([
    bytesToHex(sha256(toBytes("reins-test-rp-id"))),
    bytesToHex(new Uint8Array([flags])),
    bytesToHex(new Uint8Array([0, 0, 0, 1])), // signature counter
  ]);

  const challengeB64 = base64url(toBytes(challenge));
  const clientDataJSON = `{"type":"webauthn.get","challenge":"${challengeB64}","origin":"https://reins.test"}`;

  const typeIndex = 1n;
  const challengeIndex = 23n;

  const clientDataHash = sha256(toBytes(clientDataJSON));
  const messageHash = sha256(concatBytes(toBytes(authenticatorData), clientDataHash));

  const signature = p256.sign(messageHash, ownerPrivateKey);
  const r = BigInt(bytesToHex(signature.slice(0, 32)));
  const s = BigInt(bytesToHex(signature.slice(32, 64)));

  return {
    authenticatorData,
    clientDataJSON,
    challengeIndex,
    typeIndex,
    r,
    s,
  };
}

export function derivePublicKey(ownerPrivateKey: Uint8Array): { x: bigint; y: bigint } {
  const uncompressed = p256.getPublicKey(ownerPrivateKey, false); // 0x04 || x || y
  const x = BigInt(bytesToHex(uncompressed.slice(1, 33)));
  const y = BigInt(bytesToHex(uncompressed.slice(33, 65)));
  return { x, y };
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}
