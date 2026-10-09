// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAttestor} from "./interfaces/IAttestor.sol";
import {IReinsAccount} from "./interfaces/IReinsAccount.sol";

/// @title Attestor
/// @notice Global, singleton issuer of Reins attestations (PRD §5.4, §7).
///         An attestation is a thin pointer, not a frozen certificate:
///         verifying one re-checks live chain state through the issuing
///         ReinsAccount, so a revocation that happens after issuance is
///         reflected immediately — "this key, this policy, still valid, as
///         of this block," checkable by anyone, no account needed.
contract Attestor is Ownable, IAttestor {
    address public factory;
    bool public factorySet;

    mapping(address => bool) public isAuthorizedAccount;

    uint256 private nextAttestationId = 1;
    mapping(uint256 => Attestation) private attestations;

    event FactorySet(address indexed factory);
    event AccountAuthorized(address indexed account);

    error NotFactory();
    error NotAuthorizedAccount();
    error FactoryAlreadySet();
    error AttestationNotFound();
    error ZeroAddress();

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    constructor(address admin) Ownable(admin) {}

    function setFactory(address factory_) external onlyOwner {
        if (factorySet) revert FactoryAlreadySet();
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
        factorySet = true;
        emit FactorySet(factory_);
    }

    function authorizeAccount(address account) external onlyFactory {
        isAuthorizedAccount[account] = true;
        emit AccountAuthorized(account);
    }

    function issueAttestation(address agentKey, bytes32 mandateDigest, uint256 receiptId)
        external
        returns (uint256 attestationId)
    {
        if (!isAuthorizedAccount[msg.sender]) revert NotAuthorizedAccount();

        attestationId = nextAttestationId++;
        attestations[attestationId] = Attestation({
            account: msg.sender,
            agentKey: agentKey,
            mandateDigest: mandateDigest,
            receiptId: receiptId,
            issuedAtBlock: block.number
        });

        emit AttestationIssued(attestationId, msg.sender, agentKey, receiptId);
    }

    function verify(uint256 attestationId)
        external
        view
        returns (bool valid, string memory reason, Attestation memory att)
    {
        att = attestations[attestationId];
        if (att.account == address(0)) {
            return (false, "NotFound", att);
        }
        (valid, reason) = IReinsAccount(att.account).isAgentCurrentlyValid(att.agentKey, att.mandateDigest);
        return (valid, reason, att);
    }
}
