// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ISettlementGate {
    function evaluate(
        address payee,
        uint256 amount,
        uint256 minSettlementAmount,
        uint16 minDistinctPayers,
        uint256 probationCap,
        address externalOracle
    ) external returns (bool allowed, string memory reason);
}
