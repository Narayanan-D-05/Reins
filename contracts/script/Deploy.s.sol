// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ReceiptBook} from "../src/ReceiptBook.sol";
import {Attestor} from "../src/Attestor.sol";
import {SettlementGate} from "../src/SettlementGate.sol";
import {ReinsAccountFactory} from "../src/factory/ReinsAccountFactory.sol";

/// @notice Deploys the Reins core system: ReceiptBook, Attestor,
///         SettlementGate, and the ReinsAccountFactory, then wires the
///         factory as the authorized caller on ReceiptBook and Attestor.
/// @dev Run with:
///   forge script script/Deploy.s.sol:Deploy --rpc-url monad_testnet --broadcast
/// Requires DEPLOYER_PRIVATE_KEY and MONAD_RPC_URL in contracts/.env.
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        ReceiptBook receiptBook = new ReceiptBook(deployer);
        Attestor attestor = new Attestor(deployer);
        SettlementGate settlementGate = new SettlementGate(address(receiptBook));
        ReinsAccountFactory factory =
            new ReinsAccountFactory(address(receiptBook), address(attestor), address(settlementGate));

        receiptBook.setFactory(address(factory));
        attestor.setFactory(address(factory));

        vm.stopBroadcast();

        console.log("ReceiptBook:         ", address(receiptBook));
        console.log("Attestor:            ", address(attestor));
        console.log("SettlementGate:      ", address(settlementGate));
        console.log("ReinsAccountFactory: ", address(factory));
    }
}
