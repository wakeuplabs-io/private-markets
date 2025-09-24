// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IntegrationBase} from "./IntegrationBase.sol";
import {IPredictionMarket} from "../../src/interfaces/IPredictionMarket.sol";

contract PredictionMarketCoreTest is IntegrationBase {

    function test_createMarket_returnsIncrementalIdAndStoresMarketDataCorrectly() public {
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion, block.timestamp + 1 days);

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
        vm.expectRevert();
        predictionMarket.createMarket("", block.timestamp + 1 days);
    }


    function test_processBet_increasesTotalsAndMarksBetAsProcessed() public {
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion, block.timestamp + 1 days);

        fundTreasury(1000 ether);

        vm.prank(address(wormholeReceiver));
        bytes32 betId = keccak256("bet1");
        uint256 amount = 100 ether;
        bool outcome = true;

        predictionMarket.processBet(marketId, betId, outcome, amount, testCommitment);

        assertTrue(predictionMarket.isProcessed(betId));

        assertEq(predictionMarket.getYesTotals(marketId), amount);
        assertEq(predictionMarket.getNoTotals(marketId), 0);

        (uint256 noTotal, uint256 yesTotal) = predictionMarket.getAllTotals(marketId);
        assertEq(noTotal, 0);
        assertEq(yesTotal, amount);
    }

    function test_processBet_revertsWhenMarketDoesNotExist() public {
        vm.prank(address(wormholeReceiver));
        bytes32 betId = keccak256("bet1");

        vm.expectRevert();
        predictionMarket.processBet(999, betId, true, 100 ether, testCommitment);
    }

    function test_processBet_revertsWhenBetIdAlreadyProcessed() public {
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion, block.timestamp + 1 days);

        fundTreasury(1000 ether);

        vm.prank(address(wormholeReceiver));
        bytes32 betId = keccak256("bet1");
        uint256 amount = 100 ether;

        predictionMarket.processBet(marketId, betId, true, amount, testCommitment);

        vm.expectRevert();
        predictionMarket.processBet(marketId, betId, false, amount, testCommitment);
    }

    function test_setWinnersRoot_resolvesMarketAndStoresRootWhenCalledByAdmin() public {
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion, block.timestamp + 1 days);

        // Advance time past closing time to allow resolution
        vm.warp(block.timestamp + 1 days + 1);

        bytes32 winnersRoot = keccak256("winners");
        vm.prank(admin);
        predictionMarket.setWinnersRoot(marketId, winnersRoot);

        IPredictionMarket.Market memory market = predictionMarket.getMarket(marketId);
        assertEq(uint256(market.state), uint256(IPredictionMarket.MarketState.RESOLVED));
        assertGt(market.resolvedAt, 0);

        assertEq(predictionMarket.getWinnersRoot(marketId), winnersRoot);
    }

    function test_setWinnersRoot_revertsWhenCallerIsNotMarketAdmin() public {
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion, block.timestamp + 1 days);

        // Advance time past closing time to allow resolution
        vm.warp(block.timestamp + 1 days + 1);

        bytes32 winnersRoot = keccak256("winners");
        vm.prank(user1);
        vm.expectRevert();
        predictionMarket.setWinnersRoot(marketId, winnersRoot);
    }

    function test_claim_transfersTokensToUserWhenProofIsValid() public {
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion, block.timestamp + 1 days);

        fundTreasury(1000 ether);

        vm.prank(address(wormholeReceiver));
        bytes32 betId = keccak256("bet1");
        predictionMarket.processBet(marketId, betId, true, 100 ether, testCommitment);

        // Advance time past closing time to allow resolution
        vm.warp(block.timestamp + 1 days + 1);

        bytes32 winnersRoot = keccak256(abi.encodePacked(testCommitment, uint256(100 ether)));
        vm.prank(admin);
        predictionMarket.setWinnersRoot(marketId, winnersRoot);

        bytes32[] memory proof = new bytes32[](0);

        uint256 balanceBefore = treasury.balanceOf(user1);

        vm.prank(user1);
        predictionMarket.claim(marketId, 100 ether, proof, testSecret, user1);

        uint256 balanceAfter = treasury.balanceOf(user1);
        assertEq(balanceAfter - balanceBefore, 100 ether);

        assertTrue(predictionMarket.isClaimed(marketId, testCommitment));
    }

    function test_claim_revertsWhenPayoutAlreadyClaimed() public {
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket(testQuestion, block.timestamp + 1 days);

        fundTreasury(1000 ether);

        vm.prank(address(wormholeReceiver));
        bytes32 betId = keccak256("bet1");
        predictionMarket.processBet(marketId, betId, true, 100 ether, testCommitment);

        // Advance time past closing time to allow resolution
        vm.warp(block.timestamp + 1 days + 1);

        bytes32 winnersRoot = keccak256(abi.encodePacked(testCommitment, uint256(100 ether)));
        vm.prank(admin);
        predictionMarket.setWinnersRoot(marketId, winnersRoot);

        bytes32[] memory proof = new bytes32[](0);

        vm.prank(user1);
        predictionMarket.claim(marketId, 100 ether, proof, testSecret, user1);

        vm.prank(user1);
        vm.expectRevert();
        predictionMarket.claim(marketId, 100 ether, proof, testSecret, user1);
    }

    function test_fullMarketLifecycle_worksEndToEndFromCreationToMultipleBetsAndClaims() public {
        // NOTE: This test demonstrates the complete core flow:
        // Admin creates market → process bets → resolve market → claim payouts

        // 1. Create market
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Will ETH hit $5000?", block.timestamp + 1 days);

        // 2. Multiple bets
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

        // Advance time past closing time to allow resolution
        vm.warp(block.timestamp + 1 days + 1);

        // 3. Resolve market (Yes wins) - Create a simple single-leaf Merkle tree for testing
        bytes32 commitment1ForRoot = keccak256(abi.encodePacked(marketId, bytes32("secret1")));
        bytes32 leaf1 = keccak256(abi.encodePacked(commitment1ForRoot, uint256(75 ether)));
        bytes32 winnersRoot = leaf1; // Single leaf tree

        vm.prank(admin);
        predictionMarket.setWinnersRoot(marketId, winnersRoot);

        // 4. Winner can claim with empty proof (single leaf tree)
        bytes32[] memory proof = new bytes32[](0);

        vm.prank(user1);
        predictionMarket.claim(marketId, 75 ether, proof, bytes32("secret1"), user1);

        // Verify payout
        assertEq(treasury.balanceOf(user1), 75 ether);
    }
}