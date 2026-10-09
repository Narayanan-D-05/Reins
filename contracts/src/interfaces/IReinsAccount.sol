// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IReinsAccount {
    /// @notice Live check used by Attestor.verify: is `agentKey` still
    ///         allowed to spend under the exact policy identified by
    ///         `mandateDigest`, as of the current block?
    function isAgentCurrentlyValid(address agentKey, bytes32 mandateDigest)
        external
        view
        returns (bool valid, string memory reason);
}
