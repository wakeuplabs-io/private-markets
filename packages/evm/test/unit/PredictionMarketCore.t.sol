// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PredictionMarketCore} from "../../src/core/PredictionMarketCore.sol";
import {Treasury} from "../../src/tokens/Treasury.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

/**
 * @title PredictionMarketCoreTest
 * @notice Focused unit tests for V3 PredictionMarketCore
 * @dev Strategy: 1 positive, 1-2 negative, 1 edge case per function
 */
contract PredictionMarketCoreTest is Test {
    PredictionMarketCore public predictionMarket;
    Treasury public treasury;
    MockERC20 public usdc;

    address public wormholeReceiver = makeAddr("wormholeReceiver");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    uint16 constant WORMHOLE_CHAIN_ID = 10003;
    uint256 constant EVM_CHAIN_ID = 31337;
    uint8 constant FINALITY = 1;

    function setUp() public {
        // Deploy contracts
        usdc = new MockERC20("Mock USDC", "USDC", 6, 0);
        treasury = new Treasury(address(usdc));
        predictionMarket = new PredictionMarketCore(
            payable(address(0x1)), // Mock wormhole
            WORMHOLE_CHAIN_ID,
            EVM_CHAIN_ID,
            FINALITY,
            address(treasury)
        );

        // Set ownership chain: WormholeReceiver → PredictionMarketCore → Treasury
        treasury.transferOwnership(address(predictionMarket));
        predictionMarket.transferOwnership(wormholeReceiver);

        // Fund users
        usdc.mint(user1, 10_000 * 10**6);
        usdc.mint(user2, 10_000 * 10**6);
    }

    // ============================================
    // Helpers
    // ============================================

    /// @dev Helper: Create a market (wormholeReceiver is owner)
    function _createMarket(uint256 marketId, uint256 totalPool, uint256 expiresAt) internal {
        vm.startPrank(wormholeReceiver);
        usdc.mint(wormholeReceiver, totalPool);
        usdc.approve(address(treasury), totalPool);
        predictionMarket.createMarket(marketId, totalPool, expiresAt);
        vm.stopPrank();
    }

    /// @dev Helper: Setup market with bets (150 YES, 100 NO)
    function _setupMarketWithBets(uint256 marketId) internal returns (uint256 totalPool, uint256 expiresAt) {
        totalPool = 1000 * 10**6;
        expiresAt = block.timestamp + 1 days;
        _createMarket(marketId, totalPool, expiresAt);

        vm.startPrank(wormholeReceiver);
        predictionMarket.processBet(marketId, keccak256("bet1"), true, 150 * 10**6);
        predictionMarket.processBet(marketId, keccak256("bet2"), false, 100 * 10**6);
        vm.stopPrank();
    }

    /// @dev Helper: Resolve market after expiry
    function _resolveMarket(uint256 marketId, bool winningOutcome) internal {
        (, , , , , , , uint256 expiresAt) = predictionMarket.markets(marketId);
        vm.warp(expiresAt + 1);
        vm.prank(wormholeReceiver);
        predictionMarket.resolveMarket(marketId, winningOutcome);
    }

    // ============================================
    // createMarket Tests (4)
    // ============================================

    function test_createMarket_success() public {
        uint256 marketId = 1;
        uint256 totalPool = 10_000 * 10**6;
        uint256 expiresAt = block.timestamp + 7 days;

        _createMarket(marketId, totalPool, expiresAt);

        // Verify market state
        (
            address owner,
            uint256 pool,
            uint256 yesTotal,
            uint256 noTotal,
            bool resolved,
            bool winningOutcome,
            uint256 createdAt,
            uint256 expires
        ) = predictionMarket.markets(marketId);

        assertEq(owner, wormholeReceiver);
        assertEq(pool, totalPool);
        assertEq(yesTotal, 0);
        assertEq(noTotal, 0);
        assertFalse(resolved);
        assertFalse(winningOutcome);
        assertEq(createdAt, block.timestamp);
        assertEq(expires, expiresAt);

        // Verify USDC deposited
        assertEq(usdc.balanceOf(address(treasury)), totalPool);
    }

    function test_createMarket_revertsIfMarketExists() public {
        uint256 marketId = 1;
        _createMarket(marketId, 1000 * 10**6, block.timestamp + 1 days);

        vm.startPrank(wormholeReceiver);
        usdc.mint(wormholeReceiver, 1000 * 10**6);
        usdc.approve(address(treasury), 1000 * 10**6);

        vm.expectRevert(
            abi.encodeWithSelector(
                PredictionMarketCore.MarketAlreadyExists.selector,
                marketId
            )
        );
        predictionMarket.createMarket(marketId, 1000 * 10**6, block.timestamp + 1 days);
        vm.stopPrank();
    }

    function test_createMarket_revertsIfZeroPool() public {
        vm.prank(wormholeReceiver);
        vm.expectRevert(PredictionMarketCore.ZeroTotalPool.selector);
        predictionMarket.createMarket(1, 0, block.timestamp + 1 days);
    }

    function test_createMarket_revertsIfExpired() public {
        vm.prank(wormholeReceiver);
        vm.expectRevert(PredictionMarketCore.InvalidExpiresAt.selector);
        predictionMarket.createMarket(1, 1000 * 10**6, block.timestamp);
    }

    // ============================================
    // processBet Tests (4)
    // ============================================

    function test_processBet_updatesYesTotal() public {
        uint256 marketId = 1;
        _createMarket(marketId, 1000 * 10**6, block.timestamp + 1 days);

        bytes32 betId = keccak256("bet1");
        uint256 betAmount = 200 * 10**6;

        vm.prank(wormholeReceiver);
        predictionMarket.processBet(marketId, betId, true, betAmount);

        (, , uint256 yesTotal, uint256 noTotal, , , , ) = predictionMarket.markets(marketId);
        assertEq(yesTotal, betAmount);
        assertEq(noTotal, 0);
    }

    function test_processBet_updatesNoTotal() public {
        uint256 marketId = 1;
        _createMarket(marketId, 1000 * 10**6, block.timestamp + 1 days);

        bytes32 betId = keccak256("bet1");
        uint256 betAmount = 150 * 10**6;

        vm.prank(wormholeReceiver);
        predictionMarket.processBet(marketId, betId, false, betAmount);

        (, , uint256 yesTotal, uint256 noTotal, , , , ) = predictionMarket.markets(marketId);
        assertEq(yesTotal, 0);
        assertEq(noTotal, betAmount);
    }

    function test_processBet_revertsIfDuplicateBetId() public {
        uint256 marketId = 1;
        _createMarket(marketId, 1000 * 10**6, block.timestamp + 1 days);

        bytes32 betId = keccak256("bet1");

        vm.startPrank(wormholeReceiver);
        predictionMarket.processBet(marketId, betId, true, 100 * 10**6);

        vm.expectRevert(
            abi.encodeWithSelector(
                PredictionMarketCore.BetAlreadyProcessed.selector,
                betId
            )
        );
        predictionMarket.processBet(marketId, betId, true, 100 * 10**6);
        vm.stopPrank();
    }

    function test_processBet_revertsIfMarketExpired() public {
        uint256 marketId = 1;
        uint256 expiresAt = block.timestamp + 1 days;
        _createMarket(marketId, 1000 * 10**6, expiresAt);

        // Warp past expiry
        vm.warp(expiresAt + 1);

        bytes32 betId = keccak256("bet1");
        vm.prank(wormholeReceiver);
        vm.expectRevert(
            abi.encodeWithSelector(
                PredictionMarketCore.MarketExpired.selector,
                marketId
            )
        );
        predictionMarket.processBet(marketId, betId, true, 100 * 10**6);
    }

    // ============================================
    // resolveMarket Tests (3)
    // ============================================

    function test_resolveMarket_setsYesWins() public {
        uint256 marketId = 1;
        (uint256 totalPool, uint256 expiresAt) = _setupMarketWithBets(marketId);

        // Warp past expiry and resolve
        vm.warp(expiresAt + 1);
        vm.prank(wormholeReceiver);
        predictionMarket.resolveMarket(marketId, true);

        (, , , , bool resolved, bool winningOutcome, , ) = predictionMarket.markets(marketId);
        assertTrue(resolved);
        assertTrue(winningOutcome);
    }

    function test_resolveMarket_revertsIfNotExpired() public {
        uint256 marketId = 1;
        (uint256 totalPool, uint256 expiresAt) = _setupMarketWithBets(marketId);

        // Don't warp
        vm.prank(wormholeReceiver);
        vm.expectRevert(
            abi.encodeWithSelector(
                PredictionMarketCore.MarketNotExpired.selector,
                marketId
            )
        );
        predictionMarket.resolveMarket(marketId, true);
    }

    function test_resolveMarket_revertsIfAlreadyResolved() public {
        uint256 marketId = 1;
        (uint256 totalPool, uint256 expiresAt) = _setupMarketWithBets(marketId);

        _resolveMarket(marketId, true);

        // Try again
        vm.prank(wormholeReceiver);
        vm.expectRevert(
            abi.encodeWithSelector(
                PredictionMarketCore.MarketAlreadyResolved.selector,
                marketId
            )
        );
        predictionMarket.resolveMarket(marketId, false);
    }

    // ============================================
    // processClaimAuthorization Tests (5)
    // ============================================

    function test_claim_calculatesParimutuelCorrectly() public {
        uint256 marketId = 1;
        (uint256 totalPool, ) = _setupMarketWithBets(marketId);
        _resolveMarket(marketId, true); // YES wins

        // Winner bet: 150 USDC on YES
        // Total YES bets: 150 USDC
        // Formula: payout = (150 * 1000) / 150 = 1000 USDC (all pool)
        bytes32 nullifier = keccak256("nullifier1");
        uint256 betAmount = 150 * 10**6;
        uint256 deadline = block.timestamp + 1 hours;

        uint256 balanceBefore = usdc.balanceOf(user1);

        vm.prank(wormholeReceiver);
        predictionMarket.processClaimAuthorization(
            marketId,
            nullifier,
            betAmount,
            user1,
            0,
            deadline
        );

        uint256 balanceAfter = usdc.balanceOf(user1);
        assertEq(balanceAfter - balanceBefore, totalPool); // Winner takes all
    }

    function test_claim_transfersUSDCToWinner() public {
        uint256 marketId = 1;
        _setupMarketWithBets(marketId);
        _resolveMarket(marketId, false); // NO wins

        // Winner bet: 100 USDC on NO
        // Total NO bets: 100 USDC
        // Formula: payout = (100 * 1000) / 100 = 1000 USDC
        bytes32 nullifier = keccak256("nullifier1");
        uint256 balanceBefore = usdc.balanceOf(user2);

        vm.prank(wormholeReceiver);
        predictionMarket.processClaimAuthorization(
            marketId,
            nullifier,
            100 * 10**6,
            user2,
            0,
            block.timestamp + 1 hours
        );

        uint256 balanceAfter = usdc.balanceOf(user2);
        assertEq(balanceAfter - balanceBefore, 1000 * 10**6);
    }

    function test_claim_revertsIfNullifierUsed() public {
        uint256 marketId = 1;
        _setupMarketWithBets(marketId);
        _resolveMarket(marketId, true);

        bytes32 nullifier = keccak256("nullifier1");
        uint256 deadline = block.timestamp + 1 hours;

        vm.startPrank(wormholeReceiver);
        predictionMarket.processClaimAuthorization(
            marketId,
            nullifier,
            150 * 10**6,
            user1,
            0,
            deadline
        );

        // Try duplicate
        vm.expectRevert(
            abi.encodeWithSelector(
                PredictionMarketCore.NullifierAlreadyConsumed.selector,
                nullifier
            )
        );
        predictionMarket.processClaimAuthorization(
            marketId,
            nullifier,
            150 * 10**6,
            user2,
            0,
            deadline
        );
        vm.stopPrank();
    }

    function test_claim_revertsIfMarketNotResolved() public {
        uint256 marketId = 1;
        _setupMarketWithBets(marketId);
        // Don't resolve

        bytes32 nullifier = keccak256("nullifier1");
        vm.prank(wormholeReceiver);
        vm.expectRevert(
            abi.encodeWithSelector(
                PredictionMarketCore.MarketNotResolved.selector,
                marketId
            )
        );
        predictionMarket.processClaimAuthorization(
            marketId,
            nullifier,
            150 * 10**6,
            user1,
            0,
            block.timestamp + 1 hours
        );
    }

    function test_claim_revertsIfDeadlineExpired() public {
        uint256 marketId = 1;
        _setupMarketWithBets(marketId);
        _resolveMarket(marketId, true);

        uint256 deadline = block.timestamp + 1 hours;
        vm.warp(deadline + 1); // Warp past deadline

        bytes32 nullifier = keccak256("nullifier1");
        vm.prank(wormholeReceiver);
        vm.expectRevert(PredictionMarketCore.DeadlineExpired.selector);
        predictionMarket.processClaimAuthorization(
            marketId,
            nullifier,
            150 * 10**6,
            user1,
            0,
            deadline
        );
    }

    // ============================================
    // Query Methods Tests (8)
    // ============================================

    function test_getOwnerMarketCount_returnsCorrectCount() public {
        // Create 3 markets for user1 (wormholeReceiver in our setup)
        _createMarket(1, 1000 * 10**6, block.timestamp + 1 days);
        _createMarket(2, 2000 * 10**6, block.timestamp + 2 days);
        _createMarket(3, 500 * 10**6, block.timestamp + 3 days);

        assertEq(predictionMarket.getOwnerMarketCount(wormholeReceiver), 3);
        assertEq(predictionMarket.getOwnerMarketCount(user1), 0);
    }

    function test_getAllMarketsCount_returnsCorrectCount() public {
        assertEq(predictionMarket.getAllMarketsCount(), 0);

        _createMarket(1, 1000 * 10**6, block.timestamp + 1 days);
        assertEq(predictionMarket.getAllMarketsCount(), 1);

        _createMarket(2, 2000 * 10**6, block.timestamp + 2 days);
        assertEq(predictionMarket.getAllMarketsCount(), 2);
    }

    function test_getMarketsByOwner_returnsPaginatedResults() public {
        // Create 5 markets
        for (uint256 i = 1; i <= 5; i++) {
            _createMarket(i, 1000 * 10**6, block.timestamp + 1 days);
        }

        // Get first 3 markets (offset=0, limit=3)
        (uint256[] memory ids, , uint256 total) = predictionMarket.getMarketsByOwner(wormholeReceiver, 0, 3);

        assertEq(total, 5);
        assertEq(ids.length, 3);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
        assertEq(ids[2], 3);
    }

    function test_getMarketsByOwner_returnsRemainingItems() public {
        // Create 5 markets
        for (uint256 i = 1; i <= 5; i++) {
            _createMarket(i, 1000 * 10**6, block.timestamp + 1 days);
        }

        // Get last 2 markets (offset=3, limit=10)
        (uint256[] memory ids, , uint256 total) = predictionMarket.getMarketsByOwner(wormholeReceiver, 3, 10);

        assertEq(total, 5);
        assertEq(ids.length, 2); // Only 2 remaining
        assertEq(ids[0], 4);
        assertEq(ids[1], 5);
    }

    function test_getMarketsByOwner_returnsEmptyIfOffsetTooHigh() public {
        _createMarket(1, 1000 * 10**6, block.timestamp + 1 days);

        // Offset beyond available markets
        (uint256[] memory ids, , uint256 total) = predictionMarket.getMarketsByOwner(wormholeReceiver, 5, 10);

        assertEq(total, 1);
        assertEq(ids.length, 0);
    }

    function test_getActiveMarkets_filtersCorrectly() public {
        // Create 3 markets with different states
        uint256 market1 = 1;
        uint256 market2 = 2;
        uint256 market3 = 3;

        _createMarket(market1, 1000 * 10**6, block.timestamp + 1 days);  // Active
        _createMarket(market2, 1000 * 10**6, block.timestamp + 2 days);  // Active
        _createMarket(market3, 1000 * 10**6, block.timestamp + 100);     // Will expire

        // Resolve market1 (not active)
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(wormholeReceiver);
        predictionMarket.resolveMarket(market1, true);

        // Reset time
        vm.warp(block.timestamp - 1 days - 1);

        // Warp past market3 expiry
        vm.warp(block.timestamp + 200);

        // Get active markets (should only return market2)
        (uint256[] memory ids, , uint256 total) = predictionMarket.getActiveMarkets(0, 10);

        assertEq(total, 1);
        assertEq(ids.length, 1);
        assertEq(ids[0], market2);
    }

    function test_getActiveMarkets_paginatesCorrectly() public {
        // Create 5 active markets
        for (uint256 i = 1; i <= 5; i++) {
            _createMarket(i, 1000 * 10**6, block.timestamp + 1 days);
        }

        // Get first 3
        (uint256[] memory ids1, , uint256 total1) = predictionMarket.getActiveMarkets(0, 3);
        assertEq(total1, 5);
        assertEq(ids1.length, 3);

        // Get next 2
        (uint256[] memory ids2, , uint256 total2) = predictionMarket.getActiveMarkets(3, 3);
        assertEq(total2, 5);
        assertEq(ids2.length, 2);
    }

    function test_getMarketsByOwner_revertsIfLimitTooHigh() public {
        _createMarket(1, 1000 * 10**6, block.timestamp + 1 days);

        vm.expectRevert("Limit too high");
        predictionMarket.getMarketsByOwner(wormholeReceiver, 0, 101);
    }
}
