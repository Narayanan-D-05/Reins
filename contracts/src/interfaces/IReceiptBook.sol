// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IReceiptBook {
    struct Receipt {
        address account; // the ReinsAccount (owner vault) that cleared this payment
        address agentKey; // the specific agent key that triggered it
        address payee;
        uint256 amount; // net amount actually received by payee, after fee
        bytes32 category;
        uint256 blockNumber;
        uint256 timestamp;
    }

    event ReceiptRecorded(
        uint256 indexed receiptId,
        address indexed account,
        address indexed payee,
        address agentKey,
        uint256 amount,
        bytes32 category
    );
    event FeeCollected(uint256 indexed receiptId, uint256 feeAmount);

    function authorizeAccount(address account) external;

    function recordReceipt(address agentKey, address payee, uint256 grossAmount, bytes32 category)
        external
        payable
        returns (uint256 receiptId, uint256 netAmount);

    function getPayeeStats(address payee) external view returns (uint256 totalReceived, uint256 distinctPayers);

    function getReceipt(uint256 receiptId) external view returns (Receipt memory);
}
