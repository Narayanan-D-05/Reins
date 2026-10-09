// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IReceiptBook} from "./interfaces/IReceiptBook.sol";

/// @title ReceiptBook
/// @notice Global, singleton record of every payment that actually cleared a
///         Reins guard. This is the only input to the Tier 1 settlement
///         score (PRD §6.2) — no address can self-report or vote here, only
///         a ReinsAccount that just moved real funds can write a receipt.
/// @dev "Payer" identity for distinct-payer counting is the calling
///      ReinsAccount's address (one per human owner), not the agent key —
///      otherwise one owner could spin up many agent keys under the same
///      account to fake multiple distinct payers (PRD §6.6 residual risk is
///      about distinct *accounts/wallets*, not agent keys within one).
contract ReceiptBook is Ownable, ReentrancyGuard, IReceiptBook {
    /// @dev 1% fee, in basis points, per PRD §7 architecture table.
    uint256 public constant FEE_BPS = 100;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    address public factory;
    bool public factorySet;

    mapping(address => bool) public isAuthorizedAccount;

    uint256 private nextReceiptId = 1;
    mapping(uint256 => Receipt) private receipts;

    mapping(address => uint256) private payeeTotalReceived;
    mapping(address => uint256) private payeeDistinctPayerCount;
    mapping(address => mapping(address => bool)) private payeeHasBeenPaidBy;

    uint256 public accruedFees;

    event FactorySet(address indexed factory);
    event AccountAuthorized(address indexed account);

    error NotFactory();
    error NotAuthorizedAccount();
    error FactoryAlreadySet();
    error PayeeTransferFailed();
    error ValueMismatch();
    error ZeroAddress();

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    constructor(address admin) Ownable(admin) {}

    /// @notice One-time wiring of the factory allowed to authorize new
    ///         ReinsAccount instances. Set once by the deployer after both
    ///         this contract and the factory exist (breaks the constructor
    ///         circular dependency between ReceiptBook and the factory).
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

    /// @inheritdoc IReceiptBook
    function recordReceipt(address agentKey, address payee, uint256 grossAmount, bytes32 category)
        external
        payable
        nonReentrant
        returns (uint256 receiptId, uint256 netAmount)
    {
        if (!isAuthorizedAccount[msg.sender]) revert NotAuthorizedAccount();
        if (payee == address(0) || agentKey == address(0)) revert ZeroAddress();
        if (msg.value != grossAmount) revert ValueMismatch();

        uint256 fee = (grossAmount * FEE_BPS) / BPS_DENOMINATOR;
        netAmount = grossAmount - fee;
        accruedFees += fee;

        receiptId = nextReceiptId++;
        receipts[receiptId] = Receipt({
            account: msg.sender,
            agentKey: agentKey,
            payee: payee,
            amount: netAmount,
            category: category,
            blockNumber: block.number,
            timestamp: block.timestamp
        });

        if (!payeeHasBeenPaidBy[payee][msg.sender]) {
            payeeHasBeenPaidBy[payee][msg.sender] = true;
            payeeDistinctPayerCount[payee] += 1;
        }
        payeeTotalReceived[payee] += netAmount;

        emit ReceiptRecorded(receiptId, msg.sender, payee, agentKey, netAmount, category);
        if (fee > 0) emit FeeCollected(receiptId, fee);

        (bool ok,) = payee.call{value: netAmount}("");
        if (!ok) revert PayeeTransferFailed();
    }

    function getPayeeStats(address payee) external view returns (uint256 totalReceived, uint256 distinctPayers) {
        return (payeeTotalReceived[payee], payeeDistinctPayerCount[payee]);
    }

    function getReceipt(uint256 receiptId) external view returns (Receipt memory) {
        return receipts[receiptId];
    }

    function withdrawFees(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = accruedFees;
        accruedFees = 0;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert PayeeTransferFailed();
    }
}
