// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @title WebAuthnP256
/// @notice Verifies WebAuthn authentication assertions against Monad's native
///         P256 (secp256r1) precompile at address 0x0100 (EIP-7951).
/// @dev Adapted from base-org/webauthn-sol (MIT), which itself builds on
///      Daimo's p256-verifier. Monad exposes signature verification natively,
///      so unlike the original this has no FreshCryptoLib fallback path —
///      the precompile is always available on Monad.
library WebAuthnP256 {
    struct Assertion {
        /// @dev Raw authenticatorData returned by the authenticator.
        bytes authenticatorData;
        /// @dev Raw clientDataJSON returned by the authenticator.
        string clientDataJSON;
        /// @dev Byte offset of `"challenge":"..."` inside clientDataJSON.
        uint256 challengeIndex;
        /// @dev Byte offset of `"type":"..."` inside clientDataJSON.
        uint256 typeIndex;
        /// @dev secp256r1 signature components.
        uint256 r;
        uint256 s;
    }

    bytes1 private constant AUTH_DATA_FLAGS_UP = 0x01;
    bytes1 private constant AUTH_DATA_FLAGS_UV = 0x04;

    address private constant P256_VERIFIER = address(0x0100);

    /// @dev secp256r1 curve order n, used as n/2 to guard against signature malleability.
    uint256 private constant P256_N_DIV_2 = 57896044605178124381348723474703786764998477612067880171211129530534256022184;

    bytes32 private constant EXPECTED_TYPE_HASH = keccak256('"type":"webauthn.get"');

    /// @notice Verifies a WebAuthn assertion against public key (x, y).
    /// @dev Mirrors the verification steps in the WebAuthn Level 2 spec section
    ///      7.2 that are relevant to this context (signature, challenge, type,
    ///      and presence/verification flags). Origin and rpIdHash are
    ///      intentionally not checked here — see the authenticator's own
    ///      enforcement — callers that need origin pinning should check it
    ///      against clientDataJSON themselves before calling this.
    function verify(bytes memory challenge, bool requireUV, Assertion memory assertion, uint256 x, uint256 y)
        internal
        view
        returns (bool)
    {
        if (assertion.s > P256_N_DIV_2) return false;

        bytes memory clientDataBytes = bytes(assertion.clientDataJSON);

        bytes memory typeSlice = _slice(clientDataBytes, assertion.typeIndex, 21);
        if (keccak256(typeSlice) != EXPECTED_TYPE_HASH) return false;

        bytes memory expectedChallenge = bytes(string.concat('"challenge":"', Base64.encodeURL(challenge), '"'));
        bytes memory actualChallenge = _slice(clientDataBytes, assertion.challengeIndex, expectedChallenge.length);
        if (keccak256(actualChallenge) != keccak256(expectedChallenge)) return false;

        if (assertion.authenticatorData.length < 33) return false;
        if (assertion.authenticatorData[32] & AUTH_DATA_FLAGS_UP != AUTH_DATA_FLAGS_UP) return false;
        if (requireUV && (assertion.authenticatorData[32] & AUTH_DATA_FLAGS_UV) != AUTH_DATA_FLAGS_UV) {
            return false;
        }

        bytes32 clientDataHash = sha256(clientDataBytes);
        bytes32 messageHash = sha256(abi.encodePacked(assertion.authenticatorData, clientDataHash));

        return verifyRawSignature(messageHash, assertion.r, assertion.s, x, y);
    }

    /// @notice Verifies a raw P256 signature over a 32-byte digest, with no
    ///         WebAuthn envelope. Used for owner actions (setPolicy, pullReins)
    ///         that sign a Reins-defined digest directly rather than through a
    ///         full WebAuthn ceremony.
    function verifyRawSignature(bytes32 messageHash, uint256 r, uint256 s, uint256 x, uint256 y)
        internal
        view
        returns (bool)
    {
        if (s > P256_N_DIV_2) return false;

        (bool ok, bytes memory ret) = P256_VERIFIER.staticcall(abi.encodePacked(messageHash, r, s, x, y));
        if (!ok || ret.length != 32) return false;
        return abi.decode(ret, (uint256)) == 1;
    }

    function _slice(bytes memory data, uint256 start, uint256 len) private pure returns (bytes memory out) {
        require(start + len <= data.length, "WebAuthnP256: slice out of bounds");
        out = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            out[i] = data[start + i];
        }
    }
}
