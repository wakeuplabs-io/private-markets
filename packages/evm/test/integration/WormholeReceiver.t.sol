// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IntegrationBase} from "./IntegrationBase.sol";
import {IPredictionMarket} from "../../src/interfaces/IPredictionMarket.sol";

contract WormholeReceiverTest is IntegrationBase {

    function test_registerEmitter_storesEmitterAddressForGivenChainId() public {
        uint16 newChainId = 1; // Ethereum mainnet
        bytes32 newEmitter = bytes32(uint256(0x5678));

        vm.prank(owner);
        wormholeReceiver.registerEmitter(newChainId, newEmitter);

        assertEq(wormholeReceiver.getRegisteredEmitter(newChainId), newEmitter);
    }

    function test_registerEmitter_revertsWhenCallerIsNotOwner() public {
        vm.prank(user1); // Non-owner
        vm.expectRevert(); // Ownable: caller is not the owner (inherited from State)
        wormholeReceiver.registerEmitter(1, bytes32(uint256(0x5678)));
    }

    function test_registerEmitter_revertsWhenEmitterAddressIsZero() public {
        vm.prank(owner);
        vm.expectRevert(); // ZeroEmitterAddress custom error
        wormholeReceiver.registerEmitter(1, bytes32(0));
    }

    function test_getRegisteredEmitter_returnsCorrectEmitterForChainId() public {
        // Check default registered emitter
        assertEq(wormholeReceiver.getRegisteredEmitter(AZTEC_CHAIN_ID), bytes32(uint256(0x1234)));

        // Check unregistered chain returns zero
        assertEq(wormholeReceiver.getRegisteredEmitter(999), bytes32(0));
    }

    function test_inheritedGetters_returnCorrectConfigurationValues() public {
        // Test that WormholeReceiver inherits from PredictionMarketGetters
        assertEq(wormholeReceiver.chainId(), WORMHOLE_CHAIN_ID);
        assertEq(wormholeReceiver.evmChainId(), EVM_CHAIN_ID);
        assertEq(wormholeReceiver.finality(), FINALITY);
        assertEq(address(wormholeReceiver.treasuryContract()), address(treasury));
    }

    function test_wormholeReceiver_connectsToPredictionMarketAndInheritsGetterFunctions() public {
        // Test that WormholeReceiver is properly configured
        assertEq(address(wormholeReceiver.PREDICTION_MARKET()), address(predictionMarket));

        // Test that it has access to market functions via inheritance
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Test market");

        // WormholeReceiver should be able to read market data
        assertEq(wormholeReceiver.getMarketCount(), 1);
        assertEq(wormholeReceiver.getMarket(marketId).question, "Test market");
    }

    function test_betProcessingIntegration_worksEndToEndWithoutRequiringVaaVerification() public {
        // NOTE: This test simulates the complete ownership flow:
        // owner → WormholeReceiver (owner) → PredictionMarketCore (owner) → Treasury
        // WormholeReceiver processes bets after VAA verification, Treasury handles fund transfers

        // Create market
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Integration test market");

        // Fund treasury (PredictionMarketCore owns Treasury and can mint)
        fundTreasury(1000 ether);

        // Process bet (WormholeReceiver owns PredictionMarketCore and can call processBet)
        vm.prank(address(wormholeReceiver));
        bytes32 betId = keccak256("integration_bet");
        uint256 amount = 300 ether;
        bool outcome = true;

        predictionMarket.processBet(marketId, betId, outcome, amount, testCommitment);

        // Verify the receiver can see the updated state
        assertTrue(wormholeReceiver.isProcessed(betId));
        assertEq(wormholeReceiver.getYesTotals(marketId), amount);
        assertEq(wormholeReceiver.getNoTotals(marketId), 0);

        // Verify market state
        assertEq(uint256(wormholeReceiver.getMarket(marketId).state), uint256(IPredictionMarket.MarketState.OPEN));
    }

    function test_multipleEmitters_canBeRegisteredForDifferentChains() public {
        // Test registering multiple emitters from different chains
        uint16[] memory chainIds = new uint16[](3);
        bytes32[] memory emitters = new bytes32[](3);

        chainIds[0] = 1;  // Ethereum
        chainIds[1] = 2;  // BSC
        chainIds[2] = 56; // Update Aztec

        emitters[0] = bytes32(uint256(0x1111));
        emitters[1] = bytes32(uint256(0x2222));
        emitters[2] = bytes32(uint256(0x3333));

        vm.startPrank(owner);

        for (uint256 i = 0; i < chainIds.length; i++) {
            wormholeReceiver.registerEmitter(chainIds[i], emitters[i]);
        }

        vm.stopPrank();

        // Verify all emitters are registered
        for (uint256 i = 0; i < chainIds.length; i++) {
            assertEq(wormholeReceiver.getRegisteredEmitter(chainIds[i]), emitters[i]);
        }
    }

    // TODO: Add proper VAA testing when we have mock Wormhole interface working
    // For now, these tests verify the basic functionality and integration

    function test_payloadValidation_correctlyParsesAndValidatesBetData() public {
        // Test our helper functions work correctly
        uint256 marketId = 1;
        bytes32 betId = keccak256("test_bet");
        bool outcome = true;
        uint256 amount = 100 ether;
        bytes32 commitment = keccak256("test_commitment");

        bytes memory payload = createBetPayload(marketId, betId, outcome, amount, commitment);

        // Payload should be 129 bytes (32 + 32 + 1 + 32 + 32)
        assertEq(payload.length, 129);

        // We can manually decode to verify
        uint256 decodedMarketId;
        bytes32 decodedBetId;
        bytes32 decodedCommitment;

        assembly {
            decodedMarketId := mload(add(payload, 32))
            decodedBetId := mload(add(payload, 64))
            decodedCommitment := mload(add(payload, 129))
        }

        assertEq(decodedMarketId, marketId);
        assertEq(decodedBetId, betId);
        assertEq(decodedCommitment, commitment);
    }
}