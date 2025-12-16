// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IntegrationBase} from "./IntegrationBase.sol";

contract WormholeReceiverTest is IntegrationBase {
    uint256 marketId;
    uint256 constant TOTAL_POOL = 1000 * 10**18;
    uint256 constant EXPIRES_AT_OFFSET = 1 days;

    function setUp() public virtual override {
        super.setUp();

        vm.startPrank(address(wormholeReceiver));
        mockErc20.mint(address(wormholeReceiver), TOTAL_POOL);
        mockErc20.approve(address(treasury), TOTAL_POOL);
        marketId = predictionMarket.createMarket("Test Market", TOTAL_POOL, block.timestamp + EXPIRES_AT_OFFSET);
        vm.stopPrank();
    }

    /**
     * @dev Computes the expected compressed amount after Aztec serialization.
     * Aztec strips trailing zeros from the LE representation.
     */
    function _computeCompressedAmount(uint256 value) internal pure returns (uint256) {
        if (value == 0) return 0;

        uint256 temp = value;
        uint256 trailingZeroBytes = 0;
        while (temp > 0 && (temp & 0xFF) == 0) {
            trailingZeroBytes++;
            temp >>= 8;
        }

        return value >> (trailingZeroBytes * 8);
    }

    // ============================================
    // BET Message Tests (0x01) - 4 tests
    // ============================================

    function test_receiveBetMessage_processesCorrectly() public {
        bytes32 betId = keccak256("bet1");
        uint256 betAmount = 100 * 10**18;
        bool outcome = true; // YES

        // Create BET payload using helper (simulates Wormhole Field format)
        bytes memory payload = createBetPayload(marketId, betId, outcome, betAmount);

        bytes memory encodedVm = createMockVaa(payload);
        wormholeReceiver.verify(encodedVm);

        // Verify bet was processed (amount is compressed due to Aztec serialization)
        uint256 expectedAmount = _computeCompressedAmount(betAmount);
        (, , , uint256 yesTotal, , , , , ) = predictionMarket.getMarket(marketId);
        assertEq(yesTotal, expectedAmount);
    }

    function test_receiveBetMessage_updatesMarketTotals() public {
        // Process YES bet
        bytes32 bet1Id = keccak256("bet1");
        uint256 yesAmount = 150 * 10**18;
        bytes memory payload1 = createBetPayload(marketId, bet1Id, true, yesAmount);
        wormholeReceiver.verify(createMockVaa(payload1));

        // Process NO bet
        bytes32 bet2Id = keccak256("bet2");
        uint256 noAmount = 100 * 10**18;
        bytes memory payload2 = createBetPayload(marketId, bet2Id, false, noAmount);
        wormholeReceiver.verify(createMockVaa(payload2));

        // Verify totals updated correctly (amounts are compressed due to Aztec serialization)
        uint256 expectedYes = _computeCompressedAmount(yesAmount);
        uint256 expectedNo = _computeCompressedAmount(noAmount);
        (, , , uint256 yesTotal, uint256 noTotal, , , , ) = predictionMarket.getMarket(marketId);
        assertEq(yesTotal, expectedYes);
        assertEq(noTotal, expectedNo);
    }

    function test_receiveBetMessage_revertsIfUnregisteredSender() public {
        bytes32 betId = keccak256("bet1");
        bytes memory payload = createBetPayload(marketId, betId, true, 100 * 10**18);

        bytes32 unregisteredEmitter = bytes32(uint256(0x9999));
        vm.prank(address(owner));
        wormholeReceiver.setRegisteredSender(AZTEC_CHAIN_ID, unregisteredEmitter);

        bytes memory encodedVm = createMockVaa(payload);

        vm.expectRevert("Invalid emitter: source not recognized");
        wormholeReceiver.verify(encodedVm);
    }

    function test_receiveBetMessage_revertsIfDuplicateVAA() public {
        bytes32 betId = keccak256("bet1");
        bytes memory payload = createBetPayload(marketId, betId, true, 100 * 10**18);

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
        uint256 betAmount = 150 * 10**18;
        bytes memory betPayload = createBetPayload(marketId, bet1Id, true, betAmount);
        wormholeReceiver.verify(createMockVaa(betPayload));

        // Warp and resolve
        vm.warp(block.timestamp + EXPIRES_AT_OFFSET + 1);
        vm.prank(address(wormholeReceiver));
        predictionMarket.resolveMarket(marketId, true); // YES wins

        // Now process CLAIM_AUTH message
        bytes32 nullifier = keccak256("nullifier1");
        address recipient = user1;

        bytes memory claimPayload = createClaimPayload(marketId, nullifier, betAmount, recipient);

        uint256 balanceBefore = mockErc20.balanceOf(recipient);

        wormholeReceiver.verify(createMockVaa(claimPayload));

        // Verify payout transferred
        uint256 balanceAfter = mockErc20.balanceOf(recipient);
        assertGt(balanceAfter, balanceBefore); // Should receive payout
    }

    function test_receiveClaimMessage_transfersUSDC() public {
        // Setup: Process 2 bets
        // Bet 1: 150 YES
        bytes memory bet1Payload = createBetPayload(marketId, keccak256("bet1"), true, 150 * 10**18);
        wormholeReceiver.verify(createMockVaa(bet1Payload));

        // Bet 2: 100 NO
        bytes memory bet2Payload = createBetPayload(marketId, keccak256("bet2"), false, 100 * 10**18);
        wormholeReceiver.verify(createMockVaa(bet2Payload));

        // Resolve: YES wins
        vm.warp(block.timestamp + EXPIRES_AT_OFFSET + 1);
        vm.prank(address(wormholeReceiver));
        predictionMarket.resolveMarket(marketId, true);

        // Claim: betAmount=150, totalPool=1000, winningTotal=150
        // Expected payout = (150 * 1000) / 150 = 1000 USDC
        bytes memory claimPayload = createClaimPayload(marketId, keccak256("nullifier1"), 150 * 10**18, user2);

        uint256 balanceBefore = mockErc20.balanceOf(user2);

        wormholeReceiver.verify(createMockVaa(claimPayload));

        uint256 balanceAfter = mockErc20.balanceOf(user2);
        assertEq(balanceAfter - balanceBefore, TOTAL_POOL); // Winner takes all
    }

    function test_receiveClaimMessage_revertsIfUnregisteredSender() public {
        bytes memory claimPayload = createClaimPayload(marketId, keccak256("nullifier1"), 150 * 10**18, user1);

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
