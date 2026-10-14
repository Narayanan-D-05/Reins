# Sponsor technology feedback

**Project:** Reins, a passkey-rooted spending leash for AI agents on Monad Testnet
**Technologies reviewed:** Mera (`@category-labs/mera` 0.2.0), Monad's P256 precompile (EIP-7951), Envio (`envio` 3.14.1)
**Method:** Everything below comes from integrating these in a real, deployed app and reading the SDK source when behavior surprised us. Section 7 separates what we verified from what we inferred.

---

## 1. Summary

Monad's headline pitch for accounts is one idea in two halves: a passkey's **P256 public key** verified on-chain by the `0x0100` precompile, and **Mera**, which turns the same passkey's **PRF output** into ordinary secp256k1 keys. An app that uses both is the natural reading of "passkey-native on Monad".

Mera 0.2.0 serves only the second half. Its creation call (`createPasskeyWithPrfOutput`) returns the PRF output but, as far as we could determine from its source, not the credential's P256 public key, and it hardcodes ceremony options the caller cannot tune. A dapp that needs both keys from **one** passkey has to bypass Mera's creation function and drive WebAuthn itself. Failures along the way surface late and generically.

We built the workaround, shipped it, and propose a small, backward-compatible set of changes that would make "one passkey, many keys, on Monad" a first-class path instead of something each team rediscovers.

| | |
|---|---|
| **Primary finding** | Mera's creation API cannot yield the P256 key that Monad's precompile verifies, and its ceremony options are not configurable |
| **Secondary finding** | Mera leaves multi-key derivation to app code, so "many keys" is not portable between apps |
| **Developer-experience finding** | Envio's local indexer does not run natively on Windows and fails with an opaque native-binary error under WSL if dependencies were installed from Windows |
| **Cost to us** | Roughly a full debugging session on passkey creation, plus bypassing a library function we wanted to use |
| **Proposed fix size** | One new option, one new return field, one preflight helper, one derivation helper, a compatibility table in the docs |

---

## 2. The primary problem: one passkey, two keys, and an SDK that serves one of them

### 2.1 What we were trying to do

Reins gives each owner a smart-contract account controlled by a passkey, and gives each AI agent its own spending key. The design goal, stated on our landing page, is **one passkey for both**:

1. The owner key is the passkey's **P256 public key**. `ReinsAccount.setPolicy` and `pullReins` verify a WebAuthn assertion against it on-chain via the `0x0100` precompile.
2. The agent key is a **secp256k1 key derived from the same passkey's PRF output** through Mera and BIP-44, so it is re-derivable on any device and stored nowhere.

One ceremony, one prompt, two keys.

### 2.2 What the SDK gives us

From the Mera 0.2.0 source and the Monad Mera guide, `createPasskeyWithPrfOutput`:

- accepts `rp`, `user`, `prfSalt`, `timeout`, `webAuthnClient`
- hardcodes `residentKey: "required"`, `userVerification: "required"`, `attestation: "none"` and the algorithm list `[-7, -257]`
- returns the credential metadata, the salt and the 32-byte PRF output
- if creation returns no PRF output, silently runs a **second** assertion to fetch it (a second user-verification prompt)
- wraps unexpected errors as `PASSKEY_OPERATION_FAILED`

What it does not return is the credential's public key or attestation object. Monad's precompile verifies a P256 signature against exactly that public key.

### 2.3 What happened

We needed the P256 public key for `createAccount(ownerPubKeyX, ownerPubKeyY)`. Mera's creation function does not provide it, so we could not use it. We called `navigator.credentials.create()` through `ox`'s `Registration.create` instead, passing the `prf` extension ourselves with Mera's default salt (`sha256("mera.prf.salt.v1")`) so the output stays interchangeable, and used Mera only for the parts that remain: `getPasskeyPrfOutput`, `createSecp256k1SigningSession`, `toViemAccount`. The result works end to end on Monad Testnet. See [`frontend/src/lib/webauthn.ts`](./frontend/src/lib/webauthn.ts).

Then the ceremony itself failed in ways that were hard to read:

1. **A QR code for a phone, then "no passkey available" on the phone.** The browser offered the cross-device (hybrid) option and the user followed it. Nothing in the SDK, the error, or the docs connected that to PRF.
2. **"Passkey assertion failed"** from a later derivation call, with no indication of whether the user cancelled, the authenticator lacked PRF, or the credential was on a different device.
3. **A passkey that creation succeeded for but that could not be used for sign-in on the same machine**, because it had been saved to the phone during step 1.

### 2.4 Root cause

Three separate gaps combine:

| Gap | Effect |
|---|---|
| **No P256 public key in the creation result** | Apps that need on-chain passkey verification cannot use Mera's creation function. They reimplement the ceremony, and can then pick ceremony options Mera never validated |
| **No `authenticatorAttachment` control** | The default ceremony offers hybrid transport. A passkey can land on a phone the dapp can never reach again from the desktop session |
| **No early capability signal and a coarse error** | PRF support depends on browser, OS and credential provider. The SDK learns this only after the user has completed a prompt, and reports a generic failure |

The Monad guide states the constraint plainly ("on desktop Chrome, only passkeys saved to Google Password Manager return PRF"), but it lives in a notes list. The SDK does not enforce or surface it.

### 2.5 The real pain point

It is not any single bug. It is that **the two halves of passkey-on-Monad do not compose in the SDK built to make them easy.** The precompile makes passkeys first-class owners on-chain. Mera makes the same passkeys first-class key sources off-chain. A team that wants both, which is the obvious product, gets no help joining them and a ceremony whose failure modes are invisible until a user is mid-prompt.

Who it hurts: every team building an account or agent-wallet product on Monad, and every end user who is sent to scan a QR code and told nothing.

---

## 3. What could have been done

| Option | What it is | Verdict |
|---|---|---|
| **A. Do nothing, document it** | Add the PRF caveat to the quick start | Cheapest, but the failure still happens at runtime, mid-prompt |
| **B. Return the public key** | Include `publicKey` (P256 `x`, `y`) in the creation result | Removes the need to bypass the SDK. Small, additive |
| **C. Expose ceremony options** | `authenticatorAttachment`, `residentKey`, `userVerification` as options with safe defaults | Lets apps avoid the phone-only trap |
| **D. Preflight + typed errors** | Detect what the client can do before prompting and say so, and preserve the real failure cause | Turns a generic failure into an actionable one |
| **E. Canonical derivation helper** | Ship `deriveEvmAccount(prfOutput, index)` | Makes "many keys" portable between apps |
| **F. All of the above** | B + C + D + E + docs | The recommended path. Each piece is independently shippable |

---

## 4. Proposed solution

Everything here is a proposal against Mera 0.2.0. None of it exists today. Each change is additive, so existing callers keep working.

### 4.1 Return the P256 public key at creation

```ts
interface CreatePasskeyResult {
  credential: PasskeyCredentialMetadata;   // existing
  prfSalt: Uint8Array;                     // existing
  prfOutput: Uint8Array;                   // existing
  // new
  publicKey: { x: bigint; y: bigint };     // P256, parsed from the attestation object
}
```

The attestation parsing already exists in every WebAuthn library, including the `ox` call we use. Returning it lets one ceremony feed both `createAccount(x, y)` on-chain and the derivation off-chain, with one prompt. This single change removes the reason we had to bypass the SDK.

### 4.2 Make the ceremony configurable, with a safe default

```ts
createPasskeyWithPrfOutput({
  rp, user,
  authenticatorAttachment: "platform",     // "platform" | "cross-platform" | undefined
  // residentKey / userVerification keep their required defaults
});
```

Default to `"platform"`. A passkey on this device is the case the PRF guarantees are documented for. Apps that want roaming security keys opt in with `"cross-platform"`. Document that the option applies to creation only, because the WebAuthn request options for sign-in have no equivalent.

### 4.3 A preflight that tells the truth before the prompt

```ts
const support = await checkPasskeySupport();
// {
//   prf: "supported" | "unsupported" | "unknown",
//   platformAuthenticator: boolean,
//   hybridTransport: boolean,
//   reason?: string
// }
```

Implemented over `PublicKeyCredential.getClientCapabilities()` where the browser provides it (`extension:prf`, `hybridTransport`, `userVerifyingPlatformAuthenticator`), returning `"unknown"` elsewhere rather than guessing. Be explicit in the docs that client capability is not authenticator capability: a green preflight reduces failures, it does not eliminate them.

### 4.4 Typed errors that keep the real cause

Add distinct codes alongside the existing ones and always carry the original `DOMException` name:

| New code | Meaning |
|---|---|
| `USER_CANCELLED` | `NotAllowedError` after the user dismissed or timed out |
| `PRF_UNAVAILABLE_FOR_CREDENTIAL` | The credential exists but returned no PRF output on assertion |
| `CREDENTIAL_NOT_ON_THIS_DEVICE` | No matching credential offered for this `rpId` |

`error.cause` should hold the underlying `DOMException`, so an app can show "you cancelled" differently from "this device cannot do this".

### 4.5 A canonical derivation helper

```ts
import { deriveEvmAccount } from "@category-labs/mera";

const session = deriveEvmAccount(prfOutput, { index: 2 });   // m/44'/60'/0'/0/2
```

The guide currently has each app write its own `entropyToMnemonic` and BIP-44 code ("your code, not a mera export"). Two apps that choose slightly different encodings derive different addresses from the same passkey, which quietly defeats the "portable" promise. A canonical helper, with the path and encoding pinned and tested against vectors, makes multi-key derivation interoperable and gives "one passkey, many keys" a real API surface.

### 4.6 Documentation

Add a compatibility table at the top of the Mera guide, not in a notes list:

| Environment | Creation with PRF | Notes |
|---|---|---|
| Desktop Chrome, Google Password Manager | Supported | The reliable path |
| Desktop Chrome, OS credential provider | Varies | Test before relying on it |
| Hybrid (phone via QR) | Not reliable for this use | The `authenticatorAttachment: "platform"` default avoids it |
| Safari / iCloud Keychain | Verify and fill in | |

We have only verified the first row and the hybrid failure. The rest should be filled in by the SDK authors, who can test the matrix properly.

---

## 5. What we built and how we checked it

| What | Where |
|---|---|
| Single-ceremony creation with the `prf` extension and platform attachment | [`frontend/src/lib/webauthn.ts`](./frontend/src/lib/webauthn.ts) `createPasskey` |
| Fallback to Mera's `getPasskeyPrfOutput` if creation returns no PRF output | same file |
| BIP-44 derivation and `toViemAccount`, key zeroed immediately after reading the address | same file `deriveAgentAddress` |
| Multiple agent keys from one passkey by index | `deriveAnotherAgentAddress`, surfaced in the policy form |
| Owner key verified on-chain | `ReinsAccount.setPolicy` / `pullReins`, live on Monad Testnet |

The result on-chain: account `0xFeb5596879be7c865E9122A647aBf6a81388ae6a` with agent key `0xa5671746E0938A90B4E960Dc8F5F3e6157c5e29b` derived from the same passkey, a `setPolicy` transaction (`0x709948c5...d3853563`, block 70453030) authorized by that passkey, and a `pullReins` transaction (`0xeb56916e...dc14dff5`, block 70454806).

How we would validate the proposed fix: with 4.1 and 4.2 in place, our `createPasskey` shrinks to a single call to Mera and our extra `ox` dependency for registration is no longer needed. That deletion is the acceptance test.

---

## 6. Rollout plan, trade-offs and risks

### Phasing

| Phase | Change | Risk |
|---|---|---|
| 1 | Docs: compatibility table and the "platform only" guidance | None |
| 2 | 4.4 typed errors with `cause` | Low. Adds codes, keeps existing ones |
| 3 | 4.1 return the public key | Low. Additive field |
| 4 | 4.2 `authenticatorAttachment` option, default `"platform"` | Medium. Changes default behavior, see below |
| 5 | 4.3 preflight and 4.5 derivation helper | Low. New exports |

### Trade-offs

- **Defaulting to `"platform"` excludes roaming security keys by default.** That is a behavior change. Mitigation: ship it behind a minor version with a changelog entry, and keep `"cross-platform"` one option away.
- **Preflight can be wrong.** Client capability is not authenticator capability. Mitigation: return `"unknown"` honestly and document that the preflight reduces failures rather than guaranteeing success.
- **A canonical derivation path is a commitment.** Changing it later changes every user's addresses. Mitigation: version the helper, publish test vectors, and never alter an existing version's output.

### Success metrics

- A team can create a P256 owner key and a derived agent key from one prompt using only Mera.
- A failed ceremony reports a cause an end user can act on.
- Two independent apps derive the same address for the same passkey and index.

---

## 7. What we verified and what we inferred

Held to the same standard as the rest of this project: no claim without a source.

| Claim | Status | Basis |
|---|---|---|
| Mera's creation options are `rp`, `user`, `prfSalt`, `timeout`, `webAuthnClient`; residentKey, userVerification, algorithms are hardcoded | **Verified** | Read `library/src/passkey.ts` at 0.2.0 |
| Creation falls back to a second assertion when no PRF output is returned | **Verified** | Same source |
| The creation result carries metadata, salt and PRF output, and no public key | **Verified from the documented return shape and source summary** | Monad Mera guide, `passkey.ts`. We did not diff the compiled `.d.ts` |
| BIP-44 derivation is left to the app | **Verified** | Monad Mera guide ("your code, not a mera export") |
| Desktop Chrome returns PRF only for Google Password Manager passkeys | **Verified as documented**, not independently tested by us | Monad Mera guide |
| The QR / "no passkey available" failure occurred | **Verified** | Observed directly during testing |
| The QR failure is caused by PRF over hybrid transport specifically | **Inferred** | Consistent with the documented PRF limits. We did not isolate it. What we know is that restricting creation to `authenticatorAttachment: "platform"` removed the QR path and creation then succeeded |
| `getClientCapabilities()` can report `extension:prf` | **Inferred from the WebAuthn Level 3 spec**, not tested here | Should be confirmed per browser before the preflight ships |
| Safari / iCloud behavior | **Not tested** | Left blank in the table on purpose |

---

## 8. Secondary findings

### 8.1 Envio: local development on Windows

**Observed**, in order, running the indexer for Reins:

1. `npx envio codegen` on Windows exits with: *"envio doesn't run natively on Windows. Use WSL 2 instead."*
2. Inside WSL 2, with `node_modules` installed from Windows: *"envio's native binary for linux-x64 isn't installed (package `envio-linux-x64`)... the lockfile was generated on another platform."*
3. WSL's default Node was 18; `package.json` requires `>=22`, which we had to install through `nvm`.
4. Launching `envio dev` / `envio start` non-interactively exited with code 0 and no output on two attempts. We did not diagnose why, so we make no claim about the cause.

**Why it matters.** A large share of hackathon developers are on Windows, and Envio is a sponsor bounty. The error in step 1 is clear. Step 2 is not, because it appears only after the user has already followed the first instruction.

**Suggested fix.**

- Make the step 1 message name the exact sequence: install WSL 2, install dependencies *inside* WSL, use Node 22+.
- Detect a `node_modules` tree installed on another platform and print "delete `node_modules` and reinstall inside WSL" instead of the optional-dependency message.
- Check Node against `engines` up front, with the install command.
- Give `envio start` a clear non-interactive mode and a visible "running" line, so a silent exit 0 cannot look like success.

### 8.2 Monad: one runnable reference

The pieces for passkey accounts on Monad exist: the precompile, the Mera SDK, and ERC-8004. What is missing is one small, current, end-to-end reference that joins them (create a passkey, deploy an owner account with the P256 key, derive an agent key, sign and send). We had to assemble that from three sources. Reins is one such assembly, and the contracts, backend and frontend in this repository are free to be used as that reference.

---

## 9. Reproducing the primary finding

1. Install `@category-labs/mera@0.2.0` and `ox`.
2. Call `createPasskeyWithPrfOutput({ rp, user })` in a desktop Chrome session whose passkeys are saved to the OS provider. Observe that the result has no P256 public key to give to `createAccount`.
3. Create the credential with `Registration.create({ ..., extensions: { prf: { eval: { first: sha256("mera.prf.salt.v1") } } } })` and no `authenticatorAttachment`. When the chooser appears, pick the phone/QR option. Observe the phone report that no passkey is available.
4. Repeat with `authenticatorSelection.authenticatorAttachment: "platform"`. Observe that the QR path is gone and creation succeeds on the device.

---

## 10. Closing note

None of this is a criticism of the people who built these tools. Mera, the precompile and Envio are each well designed for the problem they chose. The friction is at the seams between them, which is where an application is, and where only an application finds out. We would rather report the seam with evidence than route around it quietly.
