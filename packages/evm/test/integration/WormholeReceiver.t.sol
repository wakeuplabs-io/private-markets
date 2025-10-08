// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IntegrationBase} from "./IntegrationBase.sol";
import "forge-std/console.sol";

/**
 * @title WormholeReceiverTest
 * @notice Integration tests for WormholeReceiver message processing
 * @dev Tests 2 message types: BET (0x01) and CLAIM_AUTH (0x02)
 */
contract WormholeReceiverTest is IntegrationBase {
    uint256 constant MARKET_ID = 1;
    uint256 constant TOTAL_POOL = 1000 * 10**6; // 1000 USDC
    uint256 constant EXPIRES_AT_OFFSET = 1 days;

    function setUp() public virtual override {
        super.setUp();

        // Create a market for testing
        vm.startPrank(address(wormholeReceiver));
        mockErc20.mint(address(wormholeReceiver), TOTAL_POOL);
        mockErc20.approve(address(treasury), TOTAL_POOL);
        predictionMarket.createMarket(MARKET_ID, TOTAL_POOL, block.timestamp + EXPIRES_AT_OFFSET);
        vm.stopPrank();
    }

    // ============================================
    // BET Message Tests (0x01) - 4 tests
    // ============================================

    function test_receiveBetMessage_processesCorrectly() public {
        bytes32 betId = keccak256("bet1");
        uint256 betAmount = 100 * 10**6;
        bool outcome = true; // YES

        // Encode BET message: 0x01 | marketId(32) | betId(32) | outcome(1) | amount(32)
        bytes memory payload = abi.encodePacked(
            uint8(0x01),
            MARKET_ID,
            betId,
            outcome,
            betAmount
        );

        bytes32 deliveryHash = keccak256(abi.encode("delivery1"));
        bytes[] memory additionalVaas = new bytes[](0);

        // Simulate relayer calling receiveWormholeMessages
        vm.prank(address(mockWormholeRelayer));
        wormholeReceiver.receiveWormholeMessages(
            payload,
            additionalVaas,
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            deliveryHash
        );

        // Verify bet was processed
        (, , uint256 yesTotal, , , , , ) = predictionMarket.markets(MARKET_ID);
        assertEq(yesTotal, betAmount);
    }

    function test_receiveBetMessage_updatesMarketTotals() public {
        // Process YES bet
        bytes32 bet1Id = keccak256("bet1");
        bytes memory payload1 = abi.encodePacked(
            uint8(0x01),
            MARKET_ID,
            bet1Id,
            true, // YES
            uint256(150 * 10**6)
        );

        vm.prank(address(mockWormholeRelayer));
        wormholeReceiver.receiveWormholeMessages(
            payload1,
            new bytes[](0),
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            keccak256(abi.encode("delivery1"))
        );

        // Process NO bet
        bytes32 bet2Id = keccak256("bet2");
        bytes memory payload2 = abi.encodePacked(
            uint8(0x01),
            MARKET_ID,
            bet2Id,
            false, // NO
            uint256(100 * 10**6)
        );

        vm.prank(address(mockWormholeRelayer));
        wormholeReceiver.receiveWormholeMessages(
            payload2,
            new bytes[](0),
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            keccak256(abi.encode("delivery2"))
        );

        // Verify totals updated correctly
        (, , uint256 yesTotal, uint256 noTotal, , , , ) = predictionMarket.markets(MARKET_ID);
        assertEq(yesTotal, 150 * 10**6);
        assertEq(noTotal, 100 * 10**6);
    }

    function test_receiveBetMessage_revertsIfUnregisteredSender() public {
        bytes32 betId = keccak256("bet1");
        bytes memory payload = abi.encodePacked(
            uint8(0x01),
            MARKET_ID,
            betId,
            true,
            uint256(100 * 10**6)
        );

        bytes32 unregisteredSender = bytes32(uint256(0x9999));

        vm.prank(address(mockWormholeRelayer));
        vm.expectRevert(); // Should revert with "Sender not registered"
        wormholeReceiver.receiveWormholeMessages(
            payload,
            new bytes[](0),
            unregisteredSender, // NOT registered
            AZTEC_CHAIN_ID,
            keccak256(abi.encode("delivery1"))
        );
    }

    function test_receiveBetMessage_revertsIfDuplicateDeliveryHash() public {
        bytes32 betId = keccak256("bet1");
        bytes memory payload = abi.encodePacked(
            uint8(0x01),
            MARKET_ID,
            betId,
            true,
            uint256(100 * 10**6)
        );

        bytes32 deliveryHash = keccak256(abi.encode("delivery1"));

        // First call - should succeed
        vm.prank(address(mockWormholeRelayer));
        wormholeReceiver.receiveWormholeMessages(
            payload,
            new bytes[](0),
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            deliveryHash
        );

        // Second call with same deliveryHash - should revert
        vm.prank(address(mockWormholeRelayer));
        vm.expectRevert(); // Should revert with "Message already processed"
        wormholeReceiver.receiveWormholeMessages(
            payload,
            new bytes[](0),
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            deliveryHash // DUPLICATE
        );
    }

    // ============================================
    // CLAIM_AUTH Message Tests (0x02) - 3 tests
    // ============================================

    function test_receiveClaimMessage_processesCorrectly() public {
        // Setup: Process bets and resolve market
        bytes32 bet1Id = keccak256("bet1");
        bytes memory betPayload = abi.encodePacked(
            uint8(0x01),
            MARKET_ID,
            bet1Id,
            true, // YES
            uint256(150 * 10**6)
        );

        vm.prank(address(mockWormholeRelayer));
        wormholeReceiver.receiveWormholeMessages(
            betPayload,
            new bytes[](0),
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            keccak256(abi.encode("delivery_bet"))
        );

        // Warp and resolve
        vm.warp(block.timestamp + EXPIRES_AT_OFFSET + 1);
        vm.prank(address(wormholeReceiver));
        predictionMarket.resolveMarket(MARKET_ID, true); // YES wins

        // Now process CLAIM_AUTH message
        bytes32 nullifier = keccak256("nullifier1");
        uint256 betAmount = 150 * 10**6;
        address recipient = user1;
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // Encode CLAIM_AUTH: 0x02 | marketId(32) | nullifier(32) | betAmount(32) | recipient(20) | nonce(32) | deadline(32)
        bytes memory claimPayload = abi.encodePacked(
            uint8(0x02),
            MARKET_ID,
            nullifier,
            betAmount,
            recipient,
            nonce,
            deadline
        );

        uint256 balanceBefore = mockErc20.balanceOf(recipient);

        vm.prank(address(mockWormholeRelayer));
        wormholeReceiver.receiveWormholeMessages(
            claimPayload,
            new bytes[](0),
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            keccak256(abi.encode("delivery_claim"))
        );

        // Verify payout transferred
        uint256 balanceAfter = mockErc20.balanceOf(recipient);
        assertGt(balanceAfter, balanceBefore); // Should receive payout
    }

    function test_receiveClaimMessage_transfersUSDC() public {
        // Setup: Process 2 bets, resolve
        vm.startPrank(address(mockWormholeRelayer));

        // Bet 1: 150 YES
        wormholeReceiver.receiveWormholeMessages(
            abi.encodePacked(uint8(0x01), MARKET_ID, keccak256("bet1"), true, uint256(150 * 10**6)),
            new bytes[](0),
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            keccak256(abi.encode("d1"))
        );

        // Bet 2: 100 NO
        wormholeReceiver.receiveWormholeMessages(
            abi.encodePacked(uint8(0x01), MARKET_ID, keccak256("bet2"), false, uint256(100 * 10**6)),
            new bytes[](0),
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            keccak256(abi.encode("d2"))
        );

        vm.stopPrank();

        // Resolve: YES wins
        vm.warp(block.timestamp + EXPIRES_AT_OFFSET + 1);
        vm.prank(address(wormholeReceiver));
        predictionMarket.resolveMarket(MARKET_ID, true);

        // Claim: betAmount=150, totalPool=1000, winningTotal=150
        // Expected payout = (150 * 1000) / 150 = 1000 USDC
        bytes memory claimPayload = abi.encodePacked(
            uint8(0x02),
            MARKET_ID,
            keccak256("nullifier1"),
            uint256(150 * 10**6),
            user2,
            uint256(1),
            block.timestamp + 1 hours
        );

        uint256 balanceBefore = mockErc20.balanceOf(user2);
        console.log("User2 balance BEFORE:", balanceBefore);

        // Debug: check Treasury balance
        uint256 treasuryBalance = mockErc20.balanceOf(address(treasury));
        console.log("Treasury balance:", treasuryBalance);
        console.log("Expected payout:", TOTAL_POOL);

        // Check market state
        (, , uint256 yesTotal, uint256 noTotal, bool resolved, bool winningOutcome, , ) = predictionMarket.markets(MARKET_ID);
        console.log("Market yesTotal:", yesTotal);
        console.log("Market noTotal:", noTotal);
        console.log("Market resolved:", resolved);
        console.log("Market winningOutcome:", winningOutcome);

        vm.prank(address(mockWormholeRelayer));
        wormholeReceiver.receiveWormholeMessages(
            claimPayload,
            new bytes[](0),
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            keccak256(abi.encode("d_claim"))
        );

        uint256 balanceAfter = mockErc20.balanceOf(user2);
        console.log("User2 balance AFTER:", balanceAfter);
        console.log("Payout received:", balanceAfter - balanceBefore);
        assertEq(balanceAfter - balanceBefore, TOTAL_POOL); // Winner takes all
    }

    function test_receiveClaimMessage_revertsIfUnregisteredSender() public {
        bytes memory claimPayload = abi.encodePacked(
            uint8(0x02),
            MARKET_ID,
            keccak256("nullifier1"),
            uint256(150 * 10**6),
            user1,
            uint256(1),
            block.timestamp + 1 hours
        );

        bytes32 unregisteredSender = bytes32(uint256(0x8888));

        vm.prank(address(mockWormholeRelayer));
        vm.expectRevert(); // Should revert with "Sender not registered"
        wormholeReceiver.receiveWormholeMessages(
            claimPayload,
            new bytes[](0),
            unregisteredSender, // NOT registered
            AZTEC_CHAIN_ID,
            keccak256(abi.encode("delivery_claim"))
        );
    }

    // ============================================
    // Registration Test - 1 test
    // ============================================

    function test_setRegisteredSender_registersAztecEmitter() public {
        bytes32 newEmitter = bytes32(uint256(0x12345));

        vm.prank(address(owner)); // registrationOwner
        wormholeReceiver.setRegisteredSender(AZTEC_CHAIN_ID, newEmitter);

        // Verify registration
        bytes32 registered = wormholeReceiver.registeredSenders(AZTEC_CHAIN_ID);
        assertEq(registered, newEmitter);
    }
}
