// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {WebAuthnP256} from "../../src/libraries/WebAuthnP256.sol";

/// @notice Builds real, correctly-signed WebAuthn assertions for tests using
///         Foundry's native `vm.signP256` / `vm.publicKeyP256` cheatcodes —
///         no mocked or fabricated signatures. This mirrors exactly what a
///         real browser's `navigator.credentials.get()` call produces.
/// @dev This is a `Test`-inheriting abstract contract rather than a library:
///      in this Foundry build, P256 cheatcodes are only recognized when
///      invoked through the test contract's own inherited `vm`, not when
///      called from inside a `library`. Test contracts that need these
///      helpers inherit from this contract instead of importing a library.
abstract contract WebAuthnTestUtils is Test {
    function buildAssertion(uint256 ownerPrivateKey, bytes memory challenge, bool userVerified)
        internal
        returns (WebAuthnP256.Assertion memory assertion)
    {
        // Minimal realistic authenticatorData: 32-byte rpIdHash + 1 flags
        // byte + 4-byte counter. Bit 0 (UP) always set; bit 2 (UV) set when
        // `userVerified` is true.
        bytes1 flags = userVerified ? bytes1(0x05) : bytes1(0x01);
        bytes memory authenticatorData = abi.encodePacked(
            keccak256("reins-test-rp-id"), // stand-in rpIdHash (not checked by WebAuthnP256.verify)
            flags,
            uint32(1) // signature counter
        );

        string memory challengeB64 = Base64.encodeURL(challenge);
        // Fixed-shape template so the byte offsets below are exact, not
        // estimated: `{"type":"webauthn.get","challenge":"` is 36 bytes,
        // with `"type":"webauthn.get"` starting at index 1 and
        // `"challenge":"..."` starting at index 23.
        string memory clientDataJSON = string.concat(
            '{"type":"webauthn.get","challenge":"', challengeB64, '","origin":"https://reins.test"}'
        );

        uint256 typeIndex = 1;
        uint256 challengeIndex = 23;

        bytes32 clientDataHash = sha256(bytes(clientDataJSON));
        bytes32 messageHash = sha256(abi.encodePacked(authenticatorData, clientDataHash));

        (bytes32 r, bytes32 s) = vm.signP256(ownerPrivateKey, messageHash);

        assertion = WebAuthnP256.Assertion({
            authenticatorData: authenticatorData,
            clientDataJSON: clientDataJSON,
            challengeIndex: challengeIndex,
            typeIndex: typeIndex,
            r: uint256(r),
            s: uint256(s)
        });
    }
}
