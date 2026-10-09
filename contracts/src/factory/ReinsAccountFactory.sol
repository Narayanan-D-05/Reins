// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReinsAccount} from "../ReinsAccount.sol";
import {IReceiptBook} from "../interfaces/IReceiptBook.sol";
import {IAttestor} from "../interfaces/IAttestor.sol";

/// @title ReinsAccountFactory
/// @notice Deploys one ReinsAccount per owner and authorizes it to write to
///         the global ReceiptBook and Attestor. ERC-8004 identity
///         registration is deliberately not wired through here — each agent
///         key registers its own ERC-8004 identity directly against the
///         registry (PRD: "Identity registry only"), independent of this
///         factory and this contract's address, so Reins never becomes a
///         dependency for using ERC-8004.
contract ReinsAccountFactory {
    address public immutable receiptBook;
    address public immutable attestor;
    address public immutable settlementGate;

    mapping(address => address[]) private accountsByCreator;

    event AccountCreated(address indexed creator, address indexed account, uint256 ownerPubKeyX, uint256 ownerPubKeyY);

    error ZeroAddress();

    constructor(address receiptBook_, address attestor_, address settlementGate_) {
        if (receiptBook_ == address(0) || attestor_ == address(0) || settlementGate_ == address(0)) {
            revert ZeroAddress();
        }
        receiptBook = receiptBook_;
        attestor = attestor_;
        settlementGate = settlementGate_;
    }

    /// @param ownerPubKeyX_ x-coordinate of the owner's WebAuthn passkey public key.
    /// @param ownerPubKeyY_ y-coordinate of the owner's WebAuthn passkey public key.
    function createAccount(uint256 ownerPubKeyX_, uint256 ownerPubKeyY_) external returns (address account) {
        ReinsAccount acct = new ReinsAccount(ownerPubKeyX_, ownerPubKeyY_, receiptBook, attestor, settlementGate);
        account = address(acct);

        IReceiptBook(receiptBook).authorizeAccount(account);
        IAttestor(attestor).authorizeAccount(account);

        accountsByCreator[msg.sender].push(account);
        emit AccountCreated(msg.sender, account, ownerPubKeyX_, ownerPubKeyY_);
    }

    function getAccounts(address creator) external view returns (address[] memory) {
        return accountsByCreator[creator];
    }
}
