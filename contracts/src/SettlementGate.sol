// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IReceiptBook} from "./interfaces/IReceiptBook.sol";
import {ISettlementOracle} from "./interfaces/ISettlementOracle.sol";
import {ISettlementGate} from "./interfaces/ISettlementGate.sol";

/// @title SettlementGate
/// @notice The settlement-verified payee gate (PRD §6). Answers one
///         question before a payment clears: has this counterparty actually
///         received real, cleared payments from real payers? Never scores
///         honesty, never accepts a self-reported or displayed signal — the
///         only inputs are Reins' own ReceiptBook history and, optionally,
///         one disclosed external oracle (PRD §6.3).
contract SettlementGate is ISettlementGate {
    IReceiptBook public immutable receiptBook;

    event GateEvaluated(address indexed payee, uint256 amount, bool allowed, string reason);

    constructor(address receiptBook_) {
        receiptBook = IReceiptBook(receiptBook_);
    }

    /// @param payee The counterparty being paid.
    /// @param amount The payment amount about to be sent.
    /// @param minSettlementAmount Tier 1 threshold: payee's total net received
    ///        volume (in the native token's smallest unit) must be at least this.
    /// @param minDistinctPayers Tier 1 threshold: payee must have been paid by
    ///        at least this many distinct Reins accounts.
    /// @param probationCap Small cap allowed even at zero settlement history
    ///        (PRD §6.4 cold-start mitigation). 0 disables probation.
    /// @param externalOracle Optional Tier 2 oracle address. address(0) disables it.
    function evaluate(
        address payee,
        uint256 amount,
        uint256 minSettlementAmount,
        uint16 minDistinctPayers,
        uint256 probationCap,
        address externalOracle
    ) external returns (bool allowed, string memory reason) {
        (uint256 totalReceived, uint256 distinctPayers) = receiptBook.getPayeeStats(payee);

        if (totalReceived >= minSettlementAmount && distinctPayers >= minDistinctPayers) {
            return _result(payee, amount, true, "Tier1Native");
        }

        if (externalOracle != address(0)) {
            try ISettlementOracle(externalOracle).checkSettlement(payee, amount) returns (bool verified, string memory) {
                if (verified) return _result(payee, amount, true, "Tier2Oracle");
            } catch {
                // Oracle failure never blocks or crashes the gate — it just
                // falls through to probation/hard-block, per PRD §6.3: the
                // per-payment cap and category allow-list already bound the
                // owner's worst-case loss even if a Tier 2 oracle is wrong.
            }
        }

        if (probationCap > 0 && amount <= probationCap) {
            return _result(payee, amount, true, "ProbationCap");
        }

        return _result(payee, amount, false, "SettlementUnverified");
    }

    function _result(address payee, uint256 amount, bool allowed, string memory reason)
        private
        returns (bool, string memory)
    {
        emit GateEvaluated(payee, amount, allowed, reason);
        return (allowed, reason);
    }
}
