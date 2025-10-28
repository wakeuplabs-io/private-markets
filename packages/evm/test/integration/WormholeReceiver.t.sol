// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IntegrationBase} from "./IntegrationBase.sol";

contract WormholeReceiverTest is IntegrationBase {
    uint256 MARKET_ID;
    uint256 constant TOTAL_POOL = 1000 * 10**6;
    uint256 constant EXPIRES_AT_OFFSET = 1 days;

    function setUp() public virtual override {
        super.setUp();

        vm.startPrank(address(wormholeReceiver));
        mockErc20.mint(address(wormholeReceiver), TOTAL_POOL);
        mockErc20.approve(address(treasury), TOTAL_POOL);
        MARKET_ID = predictionMarket.createMarket("Test Market", TOTAL_POOL, block.timestamp + EXPIRES_AT_OFFSET);
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

        bytes memory encodedVm = createMockVaa(payload);
        wormholeReceiver.verify(encodedVm);

        // Verify bet was processed
        (, , , uint256 yesTotal, , , , , ) = predictionMarket.getMarket(MARKET_ID);
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

        wormholeReceiver.verify(createMockVaa(payload1));

        // Process NO bet
        bytes32 bet2Id = keccak256("bet2");
        bytes memory payload2 = abi.encodePacked(
            uint8(0x01),
            MARKET_ID,
            bet2Id,
            false, // NO
            uint256(100 * 10**6)
        );

        wormholeReceiver.verify(createMockVaa(payload2));

        // Verify totals updated correctly
        (, , , uint256 yesTotal, uint256 noTotal, , , , ) = predictionMarket.getMarket(MARKET_ID);
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

        bytes32 unregisteredEmitter = bytes32(uint256(0x9999));
        vm.prank(address(owner));
        wormholeReceiver.setRegisteredSender(AZTEC_CHAIN_ID, unregisteredEmitter);
        
        bytes memory encodedVm = createMockVaa(payload);
        
        vm.expectRevert("Invalid emitter: source not recognized");
        wormholeReceiver.verify(encodedVm);
    }

    function test_receiveBetMessage_revertsIfDuplicateVAA() public {
        bytes32 betId = keccak256("bet1");
        bytes memory payload = abi.encodePacked(
            uint8(0x01),
            MARKET_ID,
            betId,
            true,
            uint256(100 * 10**6)
        );

        bytes memory encodedVm = createMockVaa(payload);

        // First call - should succeed
        wormholeReceiver.verify(encodedVm);

        // Second call with same VAA - should revert
        vm.expectRevert();
        wormholeReceiver.verify(encodedVm); // DUPLICATE
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

        wormholeReceiver.verify(createMockVaa(betPayload));

        // Warp and resolve
        vm.warp(block.timestamp + EXPIRES_AT_OFFSET + 1);
        vm.prank(address(wormholeReceiver));
        predictionMarket.resolveMarket(MARKET_ID, true); // YES wins

        // Now process CLAIM_AUTH message
        bytes32 nullifier = keccak256("nullifier1");
        uint256 betAmount = 150 * 10**6;
        address recipient = user1;
        // Convert address to bytes32 (recipientField) - address in last 20 bytes
        bytes32 recipientField = bytes32(uint256(uint160(recipient)));

        // Encode CLAIM_AUTH: 0x02 | marketId(32) | nullifier(32) | betAmount(32) | recipientField(32)
        bytes memory claimPayload = abi.encodePacked(
            uint8(0x02),
            MARKET_ID,
            nullifier,
            betAmount,
            recipientField
        );

        uint256 balanceBefore = mockErc20.balanceOf(recipient);

        wormholeReceiver.verify(createMockVaa(claimPayload));

        // Verify payout transferred
        uint256 balanceAfter = mockErc20.balanceOf(recipient);
        assertGt(balanceAfter, balanceBefore); // Should receive payout
    }

    function test_receiveClaimMessage_transfersUSDC() public {
        // Setup: Process 2 bets
        // Bet 1: 150 YES
        wormholeReceiver.verify(
            createMockVaa(abi.encodePacked(uint8(0x01), MARKET_ID, keccak256("bet1"), true, uint256(150 * 10**6)))
        );

        // Bet 2: 100 NO
        wormholeReceiver.verify(
            createMockVaa(abi.encodePacked(uint8(0x01), MARKET_ID, keccak256("bet2"), false, uint256(100 * 10**6)))
        );

        // Resolve: YES wins
        vm.warp(block.timestamp + EXPIRES_AT_OFFSET + 1);
        vm.prank(address(wormholeReceiver));
        predictionMarket.resolveMarket(MARKET_ID, true);

        // Claim: betAmount=150, totalPool=1000, winningTotal=150
        // Expected payout = (150 * 1000) / 150 = 1000 USDC
        // Convert address to bytes32 (recipientField) - address in last 20 bytes
        bytes32 recipientField = bytes32(uint256(uint160(user2)));

        bytes memory claimPayload = abi.encodePacked(
            uint8(0x02),
            MARKET_ID,
            keccak256("nullifier1"),
            uint256(150 * 10**6),
            recipientField
        );

        uint256 balanceBefore = mockErc20.balanceOf(user2);

        wormholeReceiver.verify(createMockVaa(claimPayload));

        uint256 balanceAfter = mockErc20.balanceOf(user2);
        assertEq(balanceAfter - balanceBefore, TOTAL_POOL); // Winner takes all
    }

    function test_receiveClaimMessage_revertsIfUnregisteredSender() public {
        // Convert address to bytes32 (recipientField) - address in last 20 bytes
        bytes32 recipientField = bytes32(uint256(uint160(user1)));

        bytes memory claimPayload = abi.encodePacked(
            uint8(0x02),
            MARKET_ID,
            keccak256("nullifier1"),
            uint256(150 * 10**6),
            recipientField
        );

        bytes32 unregisteredEmitter = bytes32(uint256(0x8888));
        vm.prank(address(owner));
        wormholeReceiver.setRegisteredSender(AZTEC_CHAIN_ID, unregisteredEmitter);

        vm.expectRevert("Invalid emitter: source not recognized");
        wormholeReceiver.verify(createMockVaa(claimPayload));
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
