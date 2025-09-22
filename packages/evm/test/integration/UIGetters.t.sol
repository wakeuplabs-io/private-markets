// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IntegrationBase} from "./IntegrationBase.sol";
import {IPredictionMarket} from "../../src/interfaces/IPredictionMarket.sol";

contract UIGettersTest is IntegrationBase {

    function test_getMarketCount_returnsZero_whenNoMarketsExist() public {
        assertEq(predictionMarket.getMarketCount(), 0);
    }

    function test_getMarketCount_returnsCorrectTotal_afterCreatingMultipleMarkets() public {
        vm.startPrank(admin);

        predictionMarket.createMarket("Market 1");
        assertEq(predictionMarket.getMarketCount(), 1);

        predictionMarket.createMarket("Market 2");
        assertEq(predictionMarket.getMarketCount(), 2);

        predictionMarket.createMarket("Private Market");
        assertEq(predictionMarket.getMarketCount(), 3);

        vm.stopPrank();
    }

    function test_getMarketIdAt_returnsCorrectAutoIncrementalIds_forValidIndices() public {
        vm.startPrank(admin);

        uint256 marketId1 = predictionMarket.createMarket("Market 1");
        uint256 marketId2 = predictionMarket.createMarket("Market 2");
        uint256 marketId3 = predictionMarket.createMarket("Private Market");

        vm.stopPrank();

        assertEq(predictionMarket.getMarketIdAt(0), marketId1);
        assertEq(predictionMarket.getMarketIdAt(1), marketId2);
        assertEq(predictionMarket.getMarketIdAt(2), marketId3);

        assertEq(marketId1, 1);
        assertEq(marketId2, 2);
        assertEq(marketId3, 3);
    }

    function test_getMarketIdAt_reverts_whenIndexOutOfBounds() public {
        vm.expectRevert("Index out of bounds");
        predictionMarket.getMarketIdAt(0);

        vm.prank(admin);
        predictionMarket.createMarket("Market 1");

        vm.expectRevert("Index out of bounds");
        predictionMarket.getMarketIdAt(1);
    }

    function test_getAllMarkets_returnsEmptyArray_whenNoMarketsExist() public {
        IPredictionMarket.Market[] memory markets = predictionMarket.getAllMarkets(0, 10);
        assertEq(markets.length, 0);
    }

    function test_getAllMarkets_supportsPagination_andReturnsCorrectMarketData() public {
        vm.startPrank(admin);

        string[] memory questions = new string[](5);
        questions[0] = "Will it rain tomorrow?";
        questions[1] = "Will ETH hit $5000?";
        questions[2] = "Will the election be close?";
        questions[3] = "Will gas prices drop?";
        questions[4] = "Will the proposal pass?";

        for (uint256 i = 0; i < 5; i++) {
            predictionMarket.createMarket(questions[i]);
        }

        vm.stopPrank();

        IPredictionMarket.Market[] memory allMarkets = predictionMarket.getAllMarkets(0, 10);
        assertEq(allMarkets.length, 5);

        for (uint256 i = 0; i < 5; i++) {
            assertEq(allMarkets[i].id, i + 1);
            assertEq(allMarkets[i].question, questions[i]);
            assertEq(allMarkets[i].admin, admin);
            assertEq(uint256(allMarkets[i].state), uint256(IPredictionMarket.MarketState.OPEN));
        }

        IPredictionMarket.Market[] memory firstPage = predictionMarket.getAllMarkets(0, 3);
        assertEq(firstPage.length, 3);
        assertEq(firstPage[0].question, questions[0]);
        assertEq(firstPage[1].question, questions[1]);
        assertEq(firstPage[2].question, questions[2]);

        IPredictionMarket.Market[] memory secondPage = predictionMarket.getAllMarkets(3, 3);
        assertEq(secondPage.length, 2);
        assertEq(secondPage[0].question, questions[3]);
        assertEq(secondPage[1].question, questions[4]);

        IPredictionMarket.Market[] memory emptyPage = predictionMarket.getAllMarkets(10, 5);
        assertEq(emptyPage.length, 0);
    }

    function test_getMarketsByState_returnsOnlyOpenMarketsWhenAllMarketsAreOpen() public {
        vm.startPrank(admin);
        predictionMarket.createMarket("Market 1");
        predictionMarket.createMarket("Market 2");
        predictionMarket.createMarket("Market 3");
        vm.stopPrank();

        IPredictionMarket.Market[] memory openMarkets = predictionMarket.getMarketsByState(IPredictionMarket.MarketState.OPEN);
        assertEq(openMarkets.length, 3);

        IPredictionMarket.Market[] memory resolvedMarkets = predictionMarket.getMarketsByState(IPredictionMarket.MarketState.RESOLVED);
        assertEq(resolvedMarkets.length, 0);

        IPredictionMarket.Market[] memory closedMarkets = predictionMarket.getMarketsByState(IPredictionMarket.MarketState.CLOSED);
        assertEq(closedMarkets.length, 0);
    }

    function test_getMarketsByState_correctlyFiltersOpenAndResolvedMarketsWhenMixed() public {
        vm.startPrank(admin);
        uint256 market1 = predictionMarket.createMarket("Market 1");
        uint256 market2 = predictionMarket.createMarket("Market 2");
        uint256 market3 = predictionMarket.createMarket("Market 3");
        uint256 market4 = predictionMarket.createMarket("Market 4");
        vm.stopPrank();

        vm.prank(admin);
        predictionMarket.setWinnersRoot(market1, keccak256("winners1"));

        vm.prank(admin);
        predictionMarket.setWinnersRoot(market3, keccak256("winners3"));

        IPredictionMarket.Market[] memory openMarkets = predictionMarket.getMarketsByState(IPredictionMarket.MarketState.OPEN);
        assertEq(openMarkets.length, 2);
        assertEq(openMarkets[0].id, market2);
        assertEq(openMarkets[1].id, market4);

        IPredictionMarket.Market[] memory resolvedMarkets = predictionMarket.getMarketsByState(IPredictionMarket.MarketState.RESOLVED);
        assertEq(resolvedMarkets.length, 2);
        assertEq(resolvedMarkets[0].id, market1);
        assertEq(resolvedMarkets[1].id, market3);

        assertTrue(resolvedMarkets[0].resolvedAt > 0);
        assertTrue(resolvedMarkets[1].resolvedAt > 0);
    }

    function test_getMarket_returnsCompleteMarketData_forValidMarketId() public {
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Individual test market");

        IPredictionMarket.Market memory market = predictionMarket.getMarket(marketId);

        assertEq(market.id, marketId);
        assertEq(market.question, "Individual test market");
        assertEq(market.admin, admin);
        assertEq(uint256(market.state), uint256(IPredictionMarket.MarketState.OPEN));
        assertGt(market.createdAt, 0);
        assertEq(market.resolvedAt, 0);
    }

    function test_getMarket_returnsEmptyStruct_forNonExistentMarketId() public {
        IPredictionMarket.Market memory market = predictionMarket.getMarket(999);

        assertEq(market.id, 0);
        assertEq(market.question, "");
        assertEq(market.admin, address(0));
        assertEq(uint256(market.state), uint256(IPredictionMarket.MarketState.OPEN));
        assertEq(market.createdAt, 0);
        assertEq(market.resolvedAt, 0);
    }

    function test_totalsGetters_correctlyTrackBettingAmountsForYesAndNoOutcomes() public {
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Totals test");

        assertEq(predictionMarket.getYesTotals(marketId), 0);
        assertEq(predictionMarket.getNoTotals(marketId), 0);

        (uint256 noTotal, uint256 yesTotal) = predictionMarket.getAllTotals(marketId);
        assertEq(noTotal, 0);
        assertEq(yesTotal, 0);

        fundTreasury(1000 ether);

        vm.startPrank(address(wormholeReceiver));
        predictionMarket.processBet(marketId, keccak256("bet1"), true, 100 ether, keccak256("commitment1"));
        predictionMarket.processBet(marketId, keccak256("bet2"), false, 150 ether, keccak256("commitment2"));
        predictionMarket.processBet(marketId, keccak256("bet3"), true, 75 ether, keccak256("commitment3"));
        vm.stopPrank();

        assertEq(predictionMarket.getYesTotals(marketId), 175 ether);
        assertEq(predictionMarket.getNoTotals(marketId), 150 ether);

        (noTotal, yesTotal) = predictionMarket.getAllTotals(marketId);
        assertEq(noTotal, 150 ether);
        assertEq(yesTotal, 175 ether);
    }

    function test_betProcessingAndClaimStatus_correctlyTracksStatusThroughoutMarketLifecycle() public {
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Processed test");

        bytes32 betId1 = keccak256("bet1");
        bytes32 betId2 = keccak256("bet2");
        bytes32 commitment1 = keccak256("commitment1");

        assertFalse(predictionMarket.isProcessed(betId1));
        assertFalse(predictionMarket.isProcessed(betId2));
        assertFalse(predictionMarket.isClaimed(marketId, commitment1));

        fundTreasury(1000 ether);

        vm.startPrank(address(wormholeReceiver));
        predictionMarket.processBet(marketId, betId1, true, 100 ether, commitment1);
        vm.stopPrank();

        assertTrue(predictionMarket.isProcessed(betId1));
        assertFalse(predictionMarket.isProcessed(betId2));

        vm.prank(admin);
        predictionMarket.setWinnersRoot(marketId, keccak256("winners"));

        bytes32[] memory proof = new bytes32[](0);
        vm.prank(user1);
        predictionMarket.claim(marketId, 50 ether, proof, bytes32("commitment1"), user1);

        assertTrue(predictionMarket.isClaimed(marketId, commitment1));
    }

    function test_winnersRoot_correctlyStoredAndRetrievedAfterMarketResolution() public {
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Winners root test");

        assertEq(predictionMarket.getWinnersRoot(marketId), bytes32(0));

        bytes32 winnersRoot = keccak256("test_winners");
        vm.prank(admin);
        predictionMarket.setWinnersRoot(marketId, winnersRoot);

        assertEq(predictionMarket.getWinnersRoot(marketId), winnersRoot);
    }

    function test_completeUIDiscoveryWorkflow_withPagination_filtering_andStateTransitions() public {

        assertEq(predictionMarket.getMarketCount(), 0);

        IPredictionMarket.Market[] memory initialMarkets = predictionMarket.getAllMarkets(0, 10);
        assertEq(initialMarkets.length, 0);

        vm.startPrank(admin);

        uint256 market1 = predictionMarket.createMarket("Will Bitcoin reach $100k in 2024?");
        uint256 market2 = predictionMarket.createMarket("Will it rain tomorrow?");
        uint256 market3 = predictionMarket.createMarket("Private prediction");
        uint256 market4 = predictionMarket.createMarket("Will the proposal pass?");

        vm.stopPrank();

        assertEq(predictionMarket.getMarketCount(), 4);

        IPredictionMarket.Market[] memory page1 = predictionMarket.getAllMarkets(0, 2);
        assertEq(page1.length, 2);
        assertEq(page1[0].id, market1);
        assertEq(page1[1].id, market2);

        IPredictionMarket.Market[] memory page2 = predictionMarket.getAllMarkets(2, 2);
        assertEq(page2.length, 2);
        assertEq(page2[0].id, market3);
        assertEq(page2[1].id, market4);

        fundTreasury(2000 ether);

        vm.startPrank(address(wormholeReceiver));
        predictionMarket.processBet(market1, keccak256("bet1"), true, 500 ether, keccak256("c1"));
        predictionMarket.processBet(market2, keccak256("bet2"), false, 300 ether, keccak256("c2"));
        predictionMarket.processBet(market4, keccak256("bet3"), true, 200 ether, keccak256("c3"));
        vm.stopPrank();

        vm.prank(admin);
        predictionMarket.setWinnersRoot(market1, keccak256("market1_winners"));

        vm.prank(admin);
        predictionMarket.setWinnersRoot(market2, keccak256("market2_winners"));

        IPredictionMarket.Market[] memory activeMarkets = predictionMarket.getMarketsByState(IPredictionMarket.MarketState.OPEN);
        assertEq(activeMarkets.length, 2);
        assertEq(activeMarkets[0].id, market3);
        assertEq(activeMarkets[1].id, market4);

        IPredictionMarket.Market[] memory resolvedMarkets = predictionMarket.getMarketsByState(IPredictionMarket.MarketState.RESOLVED);
        assertEq(resolvedMarkets.length, 2);
        assertEq(resolvedMarkets[0].id, market1);
        assertEq(resolvedMarkets[1].id, market2);

        for (uint256 i = 0; i < resolvedMarkets.length; i++) {
            IPredictionMarket.Market memory market = resolvedMarkets[i];
            (uint256 noTotal, uint256 yesTotal) = predictionMarket.getAllTotals(market.id);

            if (market.id == market1) {
                assertEq(yesTotal, 500 ether);
                assertEq(noTotal, 0);
            } else if (market.id == market2) {
                assertEq(yesTotal, 0);
                assertEq(noTotal, 300 ether);
            }
        }

        IPredictionMarket.Market memory specificMarket = predictionMarket.getMarket(market3);
        assertEq(specificMarket.question, "Private prediction");
        assertEq(specificMarket.admin, admin);
    }
}