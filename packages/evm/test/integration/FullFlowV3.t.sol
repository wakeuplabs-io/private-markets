// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PredictionMarketCore} from "../../src/core/PredictionMarketCore.sol";
import {Treasury} from "../../src/Treasury.sol";
import {MockERC20} from "../../src/MockERC20.sol";

/**
 * @title FullFlowV3Test
 * @notice End-to-end test for V3 prediction market lifecycle
 * @dev Tests complete flow: Create → Bet → Resolve → Claim → Verify Payouts
 */
contract FullFlowV3Test is Test {
    PredictionMarketCore public predictionMarket;
    Treasury public treasury;
    MockERC20 public usdc;

    address public marketOwner = makeAddr("marketOwner");
    address public user1 = makeAddr("user1"); // YES bettor
    address public user2 = makeAddr("user2"); // NO bettor
    address public user3 = makeAddr("user3"); // YES bettor

    uint16 constant WORMHOLE_CHAIN_ID = 10003;
    uint256 constant EVM_CHAIN_ID = 31337;
    uint8 constant FINALITY = 1;

    function setUp() public {
        // Deploy contracts
        usdc = new MockERC20("Mock USDC", "USDC", 6, 0);
        treasury = new Treasury(address(usdc));
        predictionMarket = new PredictionMarketCore(
            WORMHOLE_CHAIN_ID,
            EVM_CHAIN_ID,
            FINALITY,
            address(treasury)
        );

        // Set ownership: PredictionMarketCore → Treasury
        treasury.transferOwnership(address(predictionMarket));

        // Transfer ownership to marketOwner (simulates WormholeReceiver in production)
        predictionMarket.transferOwnership(marketOwner);

        // Mint USDC to users
        usdc.mint(marketOwner, 100_000 * 10**6); // 100k USDC
        usdc.mint(user1, 10_000 * 10**6);
        usdc.mint(user2, 10_000 * 10**6);
        usdc.mint(user3, 10_000 * 10**6);
    }

    /**
     * @notice Complete market lifecycle test
     * @dev Scenario:
     *  1. Market owner creates market with 1000 USDC collateral pool
     *  2. User1 bets 150 USDC on YES
     *  3. User2 bets 100 USDC on NO
     *  4. User3 bets 50 USDC on YES
     *  5. Market expires and resolves: YES wins
     *  6. User1 claims: expects (150 * 1000) / 200 = 750 USDC
     *  7. User3 claims: expects (50 * 1000) / 200 = 250 USDC
     *  8. Total distributed: 750 + 250 = 1000 USDC ✅
     */
    function test_fullMarketLifecycle_fromCreationToClaim() public {
        uint256 totalPool = 1000 * 10**6; // 1000 USDC
        uint256 expiresAt = block.timestamp + 7 days;

        // ============================================
        // Step 1: Create Market
        // ============================================
        vm.startPrank(marketOwner);
        usdc.approve(address(treasury), totalPool);
        uint256 marketId = predictionMarket.createMarket("Will ETH reach $5000?", totalPool, expiresAt);
        vm.stopPrank();

        // Verify market created
        (address owner, string memory question, uint256 pool, , , bool resolved, , , ) = predictionMarket.getMarket(marketId);
        assertEq(owner, marketOwner);
        assertEq(question, "Will ETH reach $5000?");
        assertEq(pool, totalPool);
        assertFalse(resolved);

        // Verify collateral deposited
        assertEq(usdc.balanceOf(address(treasury)), totalPool);

        // ============================================
        // Step 2: Process Bets
        // ============================================
        vm.startPrank(marketOwner);

        // User1: 150 USDC on YES
        bytes32 bet1Id = keccak256("bet1");
        predictionMarket.processBet(marketId, bet1Id, true, 150 * 10**6);

        // User2: 100 USDC on NO
        bytes32 bet2Id = keccak256("bet2");
        predictionMarket.processBet(marketId, bet2Id, false, 100 * 10**6);

        // User3: 50 USDC on YES
        bytes32 bet3Id = keccak256("bet3");
        predictionMarket.processBet(marketId, bet3Id, true, 50 * 10**6);

        vm.stopPrank();

        // Verify totals
        (, , , uint256 yesTotal, uint256 noTotal, , , , ) = predictionMarket.getMarket(marketId);
        assertEq(yesTotal, 200 * 10**6); // 150 + 50
        assertEq(noTotal, 100 * 10**6);

        // ============================================
        // Step 3: Warp Time & Resolve Market
        // ============================================
        vm.warp(expiresAt + 1);

        vm.prank(marketOwner);
        predictionMarket.resolveMarket(marketId, true); // YES wins

        // Verify resolution
        (, , , , , bool isResolved, bool winningOutcome, , ) = predictionMarket.getMarket(marketId);
        assertTrue(isResolved);
        assertTrue(winningOutcome); // YES won

        // ============================================
        // Step 4: Process Claims - User1 (YES winner)
        // ============================================
        {
            uint256 balanceBefore = usdc.balanceOf(user1);

            vm.prank(marketOwner);
            predictionMarket.processClaimAuthorization(
                marketId,
                keccak256("nullifier1"),
                150 * 10**6,
                user1
            );

            uint256 balanceAfter = usdc.balanceOf(user1);

            // User1 payout = (150 * 1000) / 200 = 750 USDC
            assertEq(balanceAfter - balanceBefore, 750 * 10**6);
        }

        // ============================================
        // Step 5: Process Claims - User3 (YES winner)
        // ============================================
        {
            uint256 balanceBefore = usdc.balanceOf(user3);

            vm.prank(marketOwner);
            predictionMarket.processClaimAuthorization(
                marketId,
                keccak256("nullifier3"),
                50 * 10**6,
                user3
            );

            uint256 balanceAfter = usdc.balanceOf(user3);

            // User3 payout = (50 * 1000) / 200 = 250 USDC
            assertEq(balanceAfter - balanceBefore, 250 * 10**6);
        }

        // ============================================
        // Step 6: Verify Total Distributed
        // ============================================
        // 750 + 250 = 1000 USDC (all pool distributed) ✅
        assertEq(usdc.balanceOf(address(treasury)), 0);
    }
}
