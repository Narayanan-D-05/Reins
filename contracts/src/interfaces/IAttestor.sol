// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IAttestor {
    struct Attestation {
        address account;
        address agentKey;
        bytes32 mandateDigest;
        uint256 receiptId;
        uint256 issuedAtBlock;
    }

    event AttestationIssued(
        uint256 indexed attestationId, address indexed account, address indexed agentKey, uint256 receiptId
    );

    function authorizeAccount(address account) external;

    function issueAttestation(address agentKey, bytes32 mandateDigest, uint256 receiptId)
        external
        returns (uint256 attestationId);

    /// @notice Live validity check — "this key, this policy, still valid, as
    ///         of this block" (PRD §5.4). Re-checks current chain state via
    ///         the issuing ReinsAccount, it does not return a frozen flag.
    function verify(uint256 attestationId) external view returns (bool valid, string memory reason, Attestation memory att);
}
