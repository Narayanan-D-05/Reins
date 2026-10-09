// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {WebAuthnP256} from "./libraries/WebAuthnP256.sol";
import {IReceiptBook} from "./interfaces/IReceiptBook.sol";
import {IAttestor} from "./interfaces/IAttestor.sol";
import {ISettlementGate} from "./interfaces/ISettlementGate.sol";
import {IReinsAccount} from "./interfaces/IReinsAccount.sol";

/// @title ReinsAccount
/// @notice One per human owner. Holds the owner's deposited funds, stores a
///         per-agent-key spending policy, and guards every payment through
///         the Settlement Gate before clearing it (PRD §5, §6).
/// @dev Owner-authorized state changes (setPolicy, pullReins) are signed by
///      the owner's real WebAuthn passkey and verified on-chain via Monad's
///      native P256 precompile (0x0100) — never by a backend auth server.
///      Every agent-level payment call (`pay`) is just a normal transaction
///      from the agent's own Mera-derived secp256k1 key; Ethereum's own
///      per-account nonce already prevents replay there, so the
///      consume-once nonce in this contract applies specifically to the
///      owner-signed actions (PRD §6.5), which can be relayed by anyone and
///      are the actual replay surface.
contract ReinsAccount is ReentrancyGuard, IReinsAccount {
    struct Policy {
        bool exists;
        bool paused;
        uint256 perPaymentCap;
        uint256 dailyCap;
        uint256 spentToday;
        uint256 currentDay;
        uint256 expiry; // unix timestamp
        uint256 minSettlementAmount;
        uint16 minDistinctPayers;
        uint256 probationCap;
        address externalOracle;
        bytes32 mandateDigest;
    }

    struct PolicyParams {
        uint256 perPaymentCap;
        uint256 dailyCap;
        uint256 expiry;
        uint256 minSettlementAmount;
        uint16 minDistinctPayers;
        uint256 probationCap;
        address externalOracle;
        bytes32[] categories;
    }

    uint256 public immutable ownerPubKeyX;
    uint256 public immutable ownerPubKeyY;
    address public immutable receiptBook;
    address public immutable attestor;
    address public immutable settlementGate;

    uint256 public ownerActionNonce;
    bool public globalPaused;

    mapping(address => Policy) public policies;
    mapping(address => mapping(bytes32 => bool)) public allowedCategories;
    mapping(address => bytes32[]) private agentCategoryList;

    event PolicySet(address indexed agentKey, bytes32 mandateDigest, uint256 nonce);
    event Paused(address indexed agentKey, bool all);
    event PaymentCleared(
        address indexed agentKey,
        address indexed payee,
        uint256 amount,
        bytes32 category,
        uint256 receiptId,
        uint256 attestationId
    );
    event PaymentBlocked(address indexed agentKey, address indexed payee, uint256 amount, bytes32 category, string reason);

    error InvalidOwnerSignature();
    error NonceMismatch();
    error SignatureExpired();
    error ZeroAddress();
    error ZeroPublicKey();

    constructor(
        uint256 ownerPubKeyX_,
        uint256 ownerPubKeyY_,
        address receiptBook_,
        address attestor_,
        address settlementGate_
    ) {
        if (ownerPubKeyX_ == 0 || ownerPubKeyY_ == 0) revert ZeroPublicKey();
        if (receiptBook_ == address(0) || attestor_ == address(0) || settlementGate_ == address(0)) {
            revert ZeroAddress();
        }
        ownerPubKeyX = ownerPubKeyX_;
        ownerPubKeyY = ownerPubKeyY_;
        receiptBook = receiptBook_;
        attestor = attestor_;
        settlementGate = settlementGate_;
    }

    receive() external payable {}

    /// @notice Owner deposits funds the account's agents can spend against.
    function deposit() external payable {}

    /// @notice Computes the mandate digest for a given agent key and policy
    ///         parameters — the exact object the owner signs at setPolicy
    ///         time and the guard re-checks at pay() time (PRD §6.5).
    function computeMandateDigest(address agentKey, PolicyParams memory params) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                address(this),
                agentKey,
                params.perPaymentCap,
                params.dailyCap,
                params.expiry,
                params.minSettlementAmount,
                params.minDistinctPayers,
                params.probationCap,
                params.externalOracle,
                keccak256(abi.encodePacked(params.categories))
            )
        );
    }

    /// @notice Sets (or replaces) an agent's policy. Requires a fresh
    ///         WebAuthn assertion from the owner's registered passkey.
    function setPolicy(
        address agentKey,
        PolicyParams calldata params,
        uint256 nonce,
        uint256 validBeforeBlock,
        WebAuthnP256.Assertion calldata assertion
    ) external {
        if (nonce != ownerActionNonce) revert NonceMismatch();
        if (block.number > validBeforeBlock) revert SignatureExpired();

        bytes32 mandateDigest = computeMandateDigest(agentKey, params);
        bytes memory challenge = abi.encode(address(this), "SET_POLICY", mandateDigest, nonce, validBeforeBlock);
        if (!WebAuthnP256.verify(challenge, true, assertion, ownerPubKeyX, ownerPubKeyY)) {
            revert InvalidOwnerSignature();
        }
        ownerActionNonce = nonce + 1;

        bytes32[] storage oldCategories = agentCategoryList[agentKey];
        for (uint256 i = 0; i < oldCategories.length; i++) {
            allowedCategories[agentKey][oldCategories[i]] = false;
        }
        delete agentCategoryList[agentKey];
        for (uint256 i = 0; i < params.categories.length; i++) {
            allowedCategories[agentKey][params.categories[i]] = true;
            agentCategoryList[agentKey].push(params.categories[i]);
        }

        policies[agentKey] = Policy({
            exists: true,
            paused: false,
            perPaymentCap: params.perPaymentCap,
            dailyCap: params.dailyCap,
            spentToday: 0,
            currentDay: block.timestamp / 1 days,
            expiry: params.expiry,
            minSettlementAmount: params.minSettlementAmount,
            minDistinctPayers: params.minDistinctPayers,
            probationCap: params.probationCap,
            externalOracle: params.externalOracle,
            mandateDigest: mandateDigest
        });

        emit PolicySet(agentKey, mandateDigest, nonce);
    }

    /// @notice Pulls the reins: revokes one agent key, or every agent key
    ///         under this account if `agentKey == address(0)`. Requires a
    ///         fresh WebAuthn assertion from the owner's registered passkey.
    function pullReins(
        address agentKey,
        uint256 nonce,
        uint256 validBeforeBlock,
        WebAuthnP256.Assertion calldata assertion
    ) external {
        if (nonce != ownerActionNonce) revert NonceMismatch();
        if (block.number > validBeforeBlock) revert SignatureExpired();

        bytes memory challenge = abi.encode(address(this), "PULL_REINS", agentKey, nonce, validBeforeBlock);
        if (!WebAuthnP256.verify(challenge, true, assertion, ownerPubKeyX, ownerPubKeyY)) {
            revert InvalidOwnerSignature();
        }
        ownerActionNonce = nonce + 1;

        if (agentKey == address(0)) {
            globalPaused = true;
        } else {
            policies[agentKey].paused = true;
        }
        emit Paused(agentKey, agentKey == address(0));
    }

    /// @notice Called directly by an agent's own key (a normal transaction,
    ///         not owner-signed) to attempt a guarded payment.
    function pay(address payee, uint256 amount, bytes32 category)
        external
        nonReentrant
        returns (bool success, uint256 receiptId, uint256 attestationId)
    {
        address agentKey = msg.sender;
        if (payee == address(0)) revert ZeroAddress();

        string memory blockedReason = _checkAndReserve(agentKey, payee, amount, category);
        if (bytes(blockedReason).length != 0) {
            emit PaymentBlocked(agentKey, payee, amount, category, blockedReason);
            return (false, 0, 0);
        }

        (receiptId, attestationId) = _settle(agentKey, payee, amount, category);
        return (true, receiptId, attestationId);
    }

    /// @dev Runs every policy + settlement-gate check and, only if all pass,
    ///      reserves the daily-cap spend. Returns "" on success, or the
    ///      block reason otherwise. Split out from `pay` purely to keep
    ///      stack depth low without requiring `--via-ir`.
    function _checkAndReserve(address agentKey, address payee, uint256 amount, bytes32 category)
        private
        returns (string memory)
    {
        Policy storage p = policies[agentKey];

        if (!p.exists || p.paused || globalPaused) return "Revoked";
        if (block.timestamp > p.expiry) return "Expired";
        if (!allowedCategories[agentKey][category]) return "CategoryNotAllowed";
        if (amount > p.perPaymentCap) return "PerPaymentCapExceeded";

        uint256 today = block.timestamp / 1 days;
        uint256 spentToday = (today == p.currentDay) ? p.spentToday : 0;
        if (spentToday + amount > p.dailyCap) return "DailyCapExceeded";
        if (address(this).balance < amount) return "InsufficientBalance";

        (bool allowed, string memory reason) = ISettlementGate(settlementGate).evaluate(
            payee, amount, p.minSettlementAmount, p.minDistinctPayers, p.probationCap, p.externalOracle
        );
        if (!allowed) return reason;

        p.spentToday = spentToday + amount;
        p.currentDay = today;
        return "";
    }

    /// @dev Moves funds and records the receipt + attestation. Only called
    ///      after `_checkAndReserve` has already passed.
    function _settle(address agentKey, address payee, uint256 amount, bytes32 category)
        private
        returns (uint256 receiptId, uint256 attestationId)
    {
        bytes32 mandateDigest = policies[agentKey].mandateDigest;
        uint256 netAmount;
        (receiptId, netAmount) = IReceiptBook(receiptBook).recordReceipt{value: amount}(agentKey, payee, amount, category);
        attestationId = IAttestor(attestor).issueAttestation(agentKey, mandateDigest, receiptId);

        emit PaymentCleared(agentKey, payee, netAmount, category, receiptId, attestationId);
    }

    /// @inheritdoc IReinsAccount
    function isAgentCurrentlyValid(address agentKey, bytes32 mandateDigest)
        external
        view
        returns (bool valid, string memory reason)
    {
        Policy storage p = policies[agentKey];
        if (!p.exists) return (false, "NotFound");
        if (globalPaused || p.paused) return (false, "Revoked");
        if (p.mandateDigest != mandateDigest) return (false, "PolicyChanged");
        if (block.timestamp > p.expiry) return (false, "Expired");
        return (true, "Valid");
    }

    function getAllowedCategories(address agentKey) external view returns (bytes32[] memory) {
        return agentCategoryList[agentKey];
    }
}
