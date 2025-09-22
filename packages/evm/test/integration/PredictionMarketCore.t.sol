// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IntegrationBase} from "./IntegrationBase.sol";
import {IPredictionMarket} from "../../src/interfaces/IPredictionMarket.sol";

contract PredictionMarketCoreTest is IntegrationBase {

    function test_createMarket_returnsIncrementalIdAndStoresMarketDataCorrectly() public {
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion);

        assertEq(marketId, 1);

        IPredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(market.id, marketId);
        assertEq(market.question, testQuestion);
        assertEq(uint256(market.state), uint256(IPredictionMarket.MarketState.OPEN));
        assertEq(market.admin, admin);
        assertGt(market.createdAt, 0);
        assertEq(market.resolvedAt, 0);
    }


    function test_createMarket_revertsWhenQuestionIsEmpty() public {
        vm.prank(admin);
        vm.expectRevert(); // EmptyQuestion custom error
        predictionMarket.createMarket("");
    }


    function test_processBet_increasesTotalsAndMarksBetAsProcessed() public {
        // Create market first
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion);

        // Fund treasury so it can mint tokens
        fundTreasury(1000 ether);

        // Process bet
        vm.prank(address(wormholeReceiver)); // Only wormholeReceiver can call processBet
        bytes32 betId = keccak256("bet1");
        uint256 amount = 100 ether;
        bool outcome = true; // Yes

        predictionMarket.processBet(marketId, betId, outcome, amount, testCommitment);

        // Check bet was processed
        assertTrue(predictionMarket.isProcessed(betId));

        // Check totals updated
        assertEq(predictionMarket.getYesTotals(marketId), amount);
        assertEq(predictionMarket.getNoTotals(marketId), 0);

        (uint256 noTotal, uint256 yesTotal) = predictionMarket.getAllTotals(marketId);
        assertEq(noTotal, 0);
        assertEq(yesTotal, amount);
    }

    function test_processBet_revertsWhenMarketDoesNotExist() public {
        vm.prank(address(wormholeReceiver));
        bytes32 betId = keccak256("bet1");

        vm.expectRevert(); // MarketNotFound custom error
        predictionMarket.processBet(999, betId, true, 100 ether, testCommitment);
    }

    function test_processBet_revertsWhenBetIdAlreadyProcessed() public {
        // Create market first
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion);

        fundTreasury(1000 ether);

        vm.prank(address(wormholeReceiver));
        bytes32 betId = keccak256("bet1");
        uint256 amount = 100 ether;

        // First bet succeeds
        predictionMarket.processBet(marketId, betId, true, amount, testCommitment);

        // Second bet with same ID should fail
        vm.expectRevert(); // BetAlreadyProcessed custom error
        predictionMarket.processBet(marketId, betId, false, amount, testCommitment);
    }

    function test_setWinnersRoot_resolvesMarketAndStoresRootWhenCalledByAdmin() public {
        // Create market
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion);

        // Set winners root as admin
        bytes32 winnersRoot = keccak256("winners");
        vm.prank(admin);
        predictionMarket.setWinnersRoot(marketId, winnersRoot);

        // Check market is resolved
        IPredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(uint256(market.state), uint256(IPredictionMarket.MarketState.RESOLVED));
        assertGt(market.resolvedAt, 0);

        // Check winners root is set
        assertEq(predictionMarket.getWinnersRoot(marketId), winnersRoot);
    }

    function test_setWinnersRoot_revertsWhenCallerIsNotMarketAdmin() public {
        // Create market
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion);

        // Try to set winners root as non-admin
        bytes32 winnersRoot = keccak256("winners");
        vm.prank(user1);
        vm.expectRevert(); // UnauthorizedResolver custom error
        predictionMarket.setWinnersRoot(marketId, winnersRoot);
    }

    function test_claim_transfersTokensToUserWhenProofIsValid() public {
        // Create and resolve market
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion);

        fundTreasury(1000 ether);

        // Process bet
        vm.prank(address(wormholeReceiver));
        bytes32 betId = keccak256("bet1");
        predictionMarket.processBet(marketId, betId, true, 100 ether, testCommitment);

        // Resolve market
        bytes32 winnersRoot = keccak256(abi.encodePacked(testCommitment, uint256(100 ether)));
        vm.prank(admin);
        predictionMarket.setWinnersRoot(marketId, winnersRoot);

        // Create simple proof (in real implementation, this would be a proper Merkle proof)
        bytes32[] memory proof = new bytes32[](0);

        uint256 balanceBefore = treasury.balanceOf(user1);

        // Claim payout
        vm.prank(user1);
        predictionMarket.claim(marketId, 100 ether, proof, testSecret, user1);

        // Check payout was transferred
        uint256 balanceAfter = treasury.balanceOf(user1);
        assertEq(balanceAfter - balanceBefore, 100 ether);

        // Check claim is marked as used
        assertTrue(predictionMarket.isClaimed(marketId, testCommitment));
    }

    function test_claim_revertsWhenPayoutAlreadyClaimed() public {
        // Setup and first claim (same as above)
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion);

        fundTreasury(1000 ether);

        vm.prank(address(wormholeReceiver));
        bytes32 betId = keccak256("bet1");
        predictionMarket.processBet(marketId, betId, true, 100 ether, testCommitment);

        bytes32 winnersRoot = keccak256(abi.encodePacked(testCommitment, uint256(100 ether)));
        vm.prank(admin);
        predictionMarket.setWinnersRoot(marketId, winnersRoot);

        bytes32[] memory proof = new bytes32[](0);

        vm.prank(user1);
        predictionMarket.claim(marketId, 100 ether, proof, testSecret, user1);

        // Try to claim again
        vm.prank(user1);
        vm.expectRevert(); // PayoutAlreadyClaimed custom error
        predictionMarket.claim(marketId, 100 ether, proof, testSecret, user1);
    }

    function test_fullMarketLifecycle_worksEndToEndFromCreationToMultipleBetsAndClaims() public {
        // NOTE: This test demonstrates the complete ownership flow:
        // Admin creates market → WormholeReceiver processes bets → PredictionMarketCore mints tokens via Treasury

        // 1. Create market (any address can create markets)
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Will ETH hit $5000?");

        assertEq(marketId, 1);
        assertEq(predictionMarket.getMarketCount(), 1);

        // 2. Multiple bets (WormholeReceiver has permission to process bets)
        fundTreasury(10000 ether);

        vm.startPrank(address(wormholeReceiver));

        // Bet 1: Yes, 100 ETH
        bytes32 bet1Id = keccak256("bet1");
        bytes32 commitment1 = keccak256(abi.encodePacked(marketId, bytes32("secret1")));
        predictionMarket.processBet(marketId, bet1Id, true, 100 ether, commitment1);

        // Bet 2: No, 150 ETH
        bytes32 bet2Id = keccak256("bet2");
        bytes32 commitment2 = keccak256(abi.encodePacked(marketId, bytes32("secret2")));
        predictionMarket.processBet(marketId, bet2Id, false, 150 ether, commitment2);

        // Bet 3: Yes, 50 ETH
        bytes32 bet3Id = keccak256("bet3");
        bytes32 commitment3 = keccak256(abi.encodePacked(marketId, bytes32("secret3")));
        predictionMarket.processBet(marketId, bet3Id, true, 50 ether, commitment3);

        vm.stopPrank();

        // 3. Check totals
        assertEq(predictionMarket.getYesTotals(marketId), 150 ether);
        assertEq(predictionMarket.getNoTotals(marketId), 150 ether);

        (uint256 noTotal, uint256 yesTotal) = predictionMarket.getAllTotals(marketId);
        assertEq(noTotal, 150 ether);
        assertEq(yesTotal, 150 ether);

        // 4. Resolve market (Yes wins)
        bytes32 winnersRoot = keccak256("yes_winners");
        vm.prank(admin);
        predictionMarket.setWinnersRoot(marketId, winnersRoot);

        // 5. Check market state
        IPredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(uint256(market.state), uint256(IPredictionMarket.MarketState.RESOLVED));
        assertGt(market.resolvedAt, 0);

        // 6. Winners can claim (simplified - no real Merkle proof verification in mock)
        bytes32[] memory proof = new bytes32[](0);

        vm.prank(user1);
        predictionMarket.claim(marketId, 75 ether, proof, bytes32("secret1"), user1);

        vm.prank(user2);
        predictionMarket.claim(marketId, 25 ether, proof, bytes32("secret3"), user2);

        // Check payouts
        assertEq(treasury.balanceOf(user1), 75 ether);
        assertEq(treasury.balanceOf(user2), 25 ether);
    }
}