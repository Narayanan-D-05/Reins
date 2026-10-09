// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ISettlementOracle
/// @notice Tier 2 pluggable interface (PRD §6.2). Any owner may point their
///         policy at a third-party contract implementing this interface.
///         Reins does not ship or endorse an implementation — this is an
///         opt-in, swappable, single-vendor dependency by design, never the
///         sole gate (PRD §6.3).
interface ISettlementOracle {
    /// @return verified Whether the oracle independently confirms real,
    ///         cleared settlement history for `payee` sufficient for `amount`.
    /// @return reason Short machine-readable reason string.
    function checkSettlement(address payee, uint256 amount) external view returns (bool verified, string memory reason);
}
