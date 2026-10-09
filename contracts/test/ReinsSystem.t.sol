// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ReceiptBook} from "../src/ReceiptBook.sol";
import {Attestor} from "../src/Attestor.sol";
import {SettlementGate} from "../src/SettlementGate.sol";
import {ReinsAccountFactory} from "../src/factory/ReinsAccountFactory.sol";
import {ReinsAccount} from "../src/ReinsAccount.sol";
import {WebAuthnP256} from "../src/libraries/WebAuthnP256.sol";
import {WebAuthnTestUtils} from "./helpers/WebAuthnTestUtils.sol";

contract ReinsSystemTest is Test, WebAuthnTestUtils {
    ReceiptBook receiptBook;
    Attestor attestor;
    SettlementGate settlementGate;
    ReinsAccountFactory factory;

    uint256 ownerPrivateKey;
    uint256 ownerPubKeyX;
    uint256 ownerPubKeyY;

    address agentKey;
    address payee;
    address deployer = address(this);

    bytes32 constant CATEGORY_ADS = keccak256("ads");
    bytes32 constant CATEGORY_COMPUTE = keccak256("compute");

    function setUp() public {
        receiptBook = new ReceiptBook(deployer);
        attestor = new Attestor(deployer);
        settlementGate = new SettlementGate(address(receiptBook));
        factory = new ReinsAccountFactory(address(receiptBook), address(attestor), address(settlementGate));

        receiptBook.setFactory(address(factory));
        attestor.setFactory(address(factory));

        ownerPrivateKey = 0xA11CE;
        (ownerPubKeyX, ownerPubKeyY) = vm.publicKeyP256(ownerPrivateKey);

        agentKey = makeAddr("agentKey");
        payee = makeAddr("payee");
    }

    function _createAccount() internal returns (ReinsAccount account) {
        address accountAddr = factory.createAccount(ownerPubKeyX, ownerPubKeyY);
        account = ReinsAccount(payable(accountAddr));
    }

    function _defaultParams(bytes32[] memory categories) internal pure returns (ReinsAccount.PolicyParams memory) {
        return ReinsAccount.PolicyParams({
            perPaymentCap: 1 ether,
            dailyCap: 5 ether,
            expiry: type(uint256).max,
            minSettlementAmount: 0,
            minDistinctPayers: 0,
            probationCap: 0,
            externalOracle: address(0),
            categories: categories
        });
    }

    function _setPolicy(ReinsAccount account, ReinsAccount.PolicyParams memory params) internal {
        uint256 nonce = account.ownerActionNonce();
        uint256 validBefore = block.number + 100;
        bytes32 digest = account.computeMandateDigest(agentKey, params);
        bytes memory challenge = abi.encode(address(account), "SET_POLICY", digest, nonce, validBefore);
        WebAuthnP256.Assertion memory assertion = buildAssertion(ownerPrivateKey, challenge, true);
        account.setPolicy(agentKey, params, nonce, validBefore, assertion);
    }

    function _pullReins(ReinsAccount account, address targetAgentKey) internal {
        uint256 nonce = account.ownerActionNonce();
        uint256 validBefore = block.number + 100;
        bytes memory challenge = abi.encode(address(account), "PULL_REINS", targetAgentKey, nonce, validBefore);
        WebAuthnP256.Assertion memory assertion = buildAssertion(ownerPrivateKey, challenge, true);
        account.pullReins(targetAgentKey, nonce, validBefore, assertion);
    }

    // ---------------------------------------------------------------
    // Policy setup via real P256/WebAuthn signatures
    // ---------------------------------------------------------------

    function test_setPolicy_withValidOwnerSignature_succeeds() public {
        ReinsAccount account = _createAccount();
        bytes32[] memory cats = new bytes32[](1);
        cats[0] = CATEGORY_ADS;
        _setPolicy(account, _defaultParams(cats));

        (
            bool exists,
            bool paused,
            uint256 perPaymentCap,
            uint256 dailyCap,
            uint256 spentToday,
            uint256 currentDay,
            uint256 expiry,
            uint256 minSettlementAmount,
            uint16 minDistinctPayers,
            uint256 probationCap,
            address externalOracle,
            bytes32 mandateDigest
        ) = account.policies(agentKey);
        (paused, perPaymentCap, dailyCap, spentToday, currentDay, expiry, minSettlementAmount, minDistinctPayers, probationCap, externalOracle, mandateDigest);
        assertTrue(exists);
        assertTrue(account.allowedCategories(agentKey, CATEGORY_ADS));
        assertFalse(account.allowedCategories(agentKey, CATEGORY_COMPUTE));
    }

    function test_setPolicy_withWrongSigner_reverts() public {
        ReinsAccount account = _createAccount();
        uint256 wrongKey = 0xB0B;
        bytes32[] memory cats = new bytes32[](1);
        cats[0] = CATEGORY_ADS;
        ReinsAccount.PolicyParams memory params = _defaultParams(cats);

        uint256 nonce = account.ownerActionNonce();
        uint256 validBefore = block.number + 100;
        bytes32 digest = account.computeMandateDigest(agentKey, params);
        bytes memory challenge = abi.encode(address(account), "SET_POLICY", digest, nonce, validBefore);
        WebAuthnP256.Assertion memory assertion = buildAssertion(wrongKey, challenge, true);

        vm.expectRevert(ReinsAccount.InvalidOwnerSignature.selector);
        account.setPolicy(agentKey, params, nonce, validBefore, assertion);
    }

    function test_setPolicy_replayedSignature_reverts() public {
        ReinsAccount account = _createAccount();
        bytes32[] memory cats = new bytes32[](1);
        cats[0] = CATEGORY_ADS;
        ReinsAccount.PolicyParams memory params = _defaultParams(cats);

        uint256 nonce = account.ownerActionNonce();
        uint256 validBefore = block.number + 100;
        bytes32 digest = account.computeMandateDigest(agentKey, params);
        bytes memory challenge = abi.encode(address(account), "SET_POLICY", digest, nonce, validBefore);
        WebAuthnP256.Assertion memory assertion = buildAssertion(ownerPrivateKey, challenge, true);

        account.setPolicy(agentKey, params, nonce, validBefore, assertion);

        // Replaying the exact same signed payload must fail: nonce already advanced.
        vm.expectRevert(ReinsAccount.NonceMismatch.selector);
        account.setPolicy(agentKey, params, nonce, validBefore, assertion);
    }

    function test_setPolicy_expiredSignatureWindow_reverts() public {
        ReinsAccount account = _createAccount();
        bytes32[] memory cats = new bytes32[](1);
        cats[0] = CATEGORY_ADS;
        ReinsAccount.PolicyParams memory params = _defaultParams(cats);

        uint256 nonce = account.ownerActionNonce();
        uint256 validBefore = block.number + 1;
        bytes32 digest = account.computeMandateDigest(agentKey, params);
        bytes memory challenge = abi.encode(address(account), "SET_POLICY", digest, nonce, validBefore);
        WebAuthnP256.Assertion memory assertion = buildAssertion(ownerPrivateKey, challenge, true);

        vm.roll(block.number + 10);

        vm.expectRevert(ReinsAccount.SignatureExpired.selector);
        account.setPolicy(agentKey, params, nonce, validBefore, assertion);
    }

    // ---------------------------------------------------------------
    // Guarded pay()
    // ---------------------------------------------------------------

    function _fundAndAuthorize() internal returns (ReinsAccount account) {
        account = _createAccount();
        vm.deal(address(this), 10 ether);
        account.deposit{value: 10 ether}();

        bytes32[] memory cats = new bytes32[](1);
        cats[0] = CATEGORY_ADS;
        _setPolicy(account, _defaultParams(cats));
    }

    function test_pay_happyPath_clearsAndIssuesAttestation() public {
        ReinsAccount account = _fundAndAuthorize();

        vm.prank(agentKey);
        (bool success, uint256 receiptId, uint256 attestationId) = account.pay(payee, 0.5 ether, CATEGORY_ADS);

        assertTrue(success);
        assertEq(receiptId, 1);
        assertEq(attestationId, 1);

        // 1% fee skimmed by ReceiptBook; payee gets net 99%.
        assertEq(payee.balance, 0.5 ether - (0.5 ether * 100 / 10_000));

        (bool valid, string memory reason,) = attestor.verify(attestationId);
        assertTrue(valid);
        assertEq(reason, "Valid");
    }

    function test_pay_blockedWhenCategoryNotAllowed() public {
        ReinsAccount account = _fundAndAuthorize();

        vm.prank(agentKey);
        vm.expectEmit(true, true, false, true);
        emit ReinsAccount.PaymentBlocked(agentKey, payee, 0.1 ether, CATEGORY_COMPUTE, "CategoryNotAllowed");
        (bool success,,) = account.pay(payee, 0.1 ether, CATEGORY_COMPUTE);
        assertFalse(success);
    }

    function test_pay_blockedWhenOverPerPaymentCap() public {
        ReinsAccount account = _fundAndAuthorize();

        vm.prank(agentKey);
        (bool success,,) = account.pay(payee, 2 ether, CATEGORY_ADS);
        assertFalse(success);
    }

    function test_pay_blockedWhenOverDailyCap() public {
        ReinsAccount account = _fundAndAuthorize();

        vm.prank(agentKey);
        account.pay(payee, 1 ether, CATEGORY_ADS);
        vm.prank(agentKey);
        account.pay(payee, 1 ether, CATEGORY_ADS);
        vm.prank(agentKey);
        account.pay(payee, 1 ether, CATEGORY_ADS);
        vm.prank(agentKey);
        account.pay(payee, 1 ether, CATEGORY_ADS);
        vm.prank(agentKey);
        account.pay(payee, 1 ether, CATEGORY_ADS); // 5 ether spent, hits dailyCap exactly

        vm.prank(agentKey);
        (bool success,,) = account.pay(payee, 0.01 ether, CATEGORY_ADS);
        assertFalse(success);
    }

    function test_pay_dailyCapResetsNextDay() public {
        ReinsAccount account = _fundAndAuthorize();

        vm.prank(agentKey);
        account.pay(payee, 1 ether, CATEGORY_ADS);

        vm.warp(block.timestamp + 2 days);

        vm.prank(agentKey);
        (bool success,,) = account.pay(payee, 1 ether, CATEGORY_ADS);
        assertTrue(success);
    }

    function test_pay_blockedWhenSettlementUnverified() public {
        ReinsAccount account = _createAccount();
        vm.deal(address(this), 10 ether);
        account.deposit{value: 10 ether}();

        bytes32[] memory cats = new bytes32[](1);
        cats[0] = CATEGORY_ADS;
        ReinsAccount.PolicyParams memory params = _defaultParams(cats);
        params.minSettlementAmount = 1 ether; // payee has zero history
        params.probationCap = 0; // no probation fallback
        _setPolicy(account, params);

        vm.prank(agentKey);
        (bool success,,) = account.pay(payee, 0.1 ether, CATEGORY_ADS);
        assertFalse(success);
    }

    function test_pay_allowedUnderProbationCapDespiteNoSettlementHistory() public {
        ReinsAccount account = _createAccount();
        vm.deal(address(this), 10 ether);
        account.deposit{value: 10 ether}();

        bytes32[] memory cats = new bytes32[](1);
        cats[0] = CATEGORY_ADS;
        ReinsAccount.PolicyParams memory params = _defaultParams(cats);
        params.minSettlementAmount = 1 ether;
        params.probationCap = 0.2 ether;
        _setPolicy(account, params);

        vm.prank(agentKey);
        (bool success,,) = account.pay(payee, 0.1 ether, CATEGORY_ADS);
        assertTrue(success);
    }

    function test_pay_blockedAfterRevocation() public {
        ReinsAccount account = _fundAndAuthorize();
        _pullReins(account, agentKey);

        vm.prank(agentKey);
        (bool success,,) = account.pay(payee, 0.1 ether, CATEGORY_ADS);
        assertFalse(success);
    }

    function test_pay_blockedAfterGlobalPullReins() public {
        ReinsAccount account = _fundAndAuthorize();
        _pullReins(account, address(0));

        vm.prank(agentKey);
        (bool success,,) = account.pay(payee, 0.1 ether, CATEGORY_ADS);
        assertFalse(success);
    }

    function testFuzz_pay_neverExceedsPerPaymentCap(uint256 amount) public {
        ReinsAccount account = _fundAndAuthorize();
        amount = bound(amount, 0, 5 ether);

        vm.prank(agentKey);
        (bool success,,) = account.pay(payee, amount, CATEGORY_ADS);

        if (amount > 1 ether) {
            assertFalse(success);
        }
    }

    // ---------------------------------------------------------------
    // Attestation is a live check, not a frozen flag
    // ---------------------------------------------------------------

    function test_attestation_becomesInvalidAfterRevocation() public {
        ReinsAccount account = _fundAndAuthorize();

        vm.prank(agentKey);
        (,, uint256 attestationId) = account.pay(payee, 0.1 ether, CATEGORY_ADS);

        (bool validBefore,,) = attestor.verify(attestationId);
        assertTrue(validBefore);

        _pullReins(account, agentKey);

        (bool validAfter, string memory reason,) = attestor.verify(attestationId);
        assertFalse(validAfter);
        assertEq(reason, "Revoked");
    }

    function test_attestation_becomesInvalidAfterPolicyChange() public {
        ReinsAccount account = _fundAndAuthorize();

        vm.prank(agentKey);
        (,, uint256 attestationId) = account.pay(payee, 0.1 ether, CATEGORY_ADS);

        bytes32[] memory cats = new bytes32[](1);
        cats[0] = CATEGORY_COMPUTE;
        _setPolicy(account, _defaultParams(cats));

        (bool valid, string memory reason,) = attestor.verify(attestationId);
        assertFalse(valid);
        assertEq(reason, "PolicyChanged");
    }

    // ---------------------------------------------------------------
    // ReceiptBook: distinct payers tracked at the account level
    // ---------------------------------------------------------------

    function test_receiptBook_distinctPayerCountedOncePerAccountNotPerAgentKey() public {
        ReinsAccount account = _createAccount();
        vm.deal(address(this), 10 ether);
        account.deposit{value: 10 ether}();

        bytes32[] memory cats = new bytes32[](1);
        cats[0] = CATEGORY_ADS;

        address secondAgentKey = makeAddr("secondAgentKey");
        ReinsAccount.PolicyParams memory params1 = _defaultParams(cats);
        _setPolicy(account, params1);

        uint256 nonce = account.ownerActionNonce();
        uint256 validBefore = block.number + 100;
        bytes32 digest2 = account.computeMandateDigest(secondAgentKey, params1);
        bytes memory challenge2 = abi.encode(address(account), "SET_POLICY", digest2, nonce, validBefore);
        WebAuthnP256.Assertion memory assertion2 = buildAssertion(ownerPrivateKey, challenge2, true);
        account.setPolicy(secondAgentKey, params1, nonce, validBefore, assertion2);

        vm.prank(agentKey);
        account.pay(payee, 0.1 ether, CATEGORY_ADS);
        vm.prank(secondAgentKey);
        account.pay(payee, 0.1 ether, CATEGORY_ADS);

        (, uint256 distinctPayers) = receiptBook.getPayeeStats(payee);
        assertEq(distinctPayers, 1); // same account, two agent keys => still one payer
    }

    function test_receiptBook_rejectsUnauthorizedCaller() public {
        vm.expectRevert(ReceiptBook.NotAuthorizedAccount.selector);
        receiptBook.recordReceipt(agentKey, payee, 1 ether, CATEGORY_ADS);
    }
}
