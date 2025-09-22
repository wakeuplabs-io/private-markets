// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IntegrationBase} from "./IntegrationBase.sol";
import {IPredictionMarket} from "../../src/interfaces/IPredictionMarket.sol";
import {WormholeReceiver} from "../../src/wormhole/WormholeReceiver.sol";

contract WormholeReceiverTest is IntegrationBase {

    function test_setRegisteredSender_storesEmitterAddressForGivenChainId() public {
        uint16 newChainId = 1;
        bytes32 newSender = bytes32(uint256(0x5678));

        vm.prank(owner);
        wormholeReceiver.setRegisteredSender(newChainId, newSender);

        assertEq(wormholeReceiver.registeredSenders(newChainId), newSender);
    }

    function test_setRegisteredSender_revertsWhenCallerIsNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Not allowed to set registered sender");
        wormholeReceiver.setRegisteredSender(1, bytes32(uint256(0x5678)));
    }

    function test_setRegisteredSender_revertsWhenSenderAddressIsZero() public {
        vm.prank(owner);
        vm.expectRevert();
        wormholeReceiver.setRegisteredSender(1, bytes32(0));
    }

    function test_registeredSenders_returnsCorrectSenderForChainId() public {
        // Check default registered sender (using realistic address)
        assertEq(wormholeReceiver.registeredSenders(AZTEC_CHAIN_ID), AZTEC_PREDICTION_CONTRACT);

        // Check unregistered chain returns zero
        assertEq(wormholeReceiver.registeredSenders(999), bytes32(0));
    }

    function test_multipleSenders_canBeRegisteredForDifferentChains() public {
        // Test registering multiple senders from different chains
        uint16[] memory chainIds = new uint16[](3);
        bytes32[] memory senders = new bytes32[](3);

        chainIds[0] = 1;  // Ethereum
        chainIds[1] = 2;  // BSC
        chainIds[2] = 56; // Update Aztec

        senders[0] = bytes32(uint256(0x1111));
        senders[1] = bytes32(uint256(0x2222));
        senders[2] = bytes32(uint256(0x3333));

        vm.startPrank(owner);

        for (uint256 i = 0; i < chainIds.length; i++) {
            wormholeReceiver.setRegisteredSender(chainIds[i], senders[i]);
        }

        vm.stopPrank();

        // Verify all senders are registered
        for (uint256 i = 0; i < chainIds.length; i++) {
            assertEq(wormholeReceiver.registeredSenders(chainIds[i]), senders[i]);
        }
    }

    // ============ Access Control Tests ============

    function test_receiveWormholeMessages_revertsWhenCallerIsNotRelayer() public {
        bytes memory payload = createBetPayload(1, keccak256("test_bet"), true, 100 ether, keccak256("commitment"));
        bytes32 sourceAddress = bytes32(uint256(0x1234));
        uint16 sourceChain = AZTEC_CHAIN_ID;
        bytes32 deliveryHash = keccak256("delivery_hash");

        vm.prank(user1); // Not the relayer
        vm.expectRevert("Only the Wormhole relayer can call this function");
        wormholeReceiver.receiveWormholeMessages(payload, new bytes[](0), sourceAddress, sourceChain, deliveryHash);
    }

    function test_receiveWormholeMessages_revertsWhenSenderNotRegistered() public {
        bytes memory payload = createBetPayload(1, keccak256("test_bet"), true, 100 ether, keccak256("commitment"));
        bytes32 unauthorizedSourceAddress = bytes32(uint256(0x9999)); // Unauthorized sender
        uint16 sourceChain = AZTEC_CHAIN_ID;
        bytes32 deliveryHash = keccak256("delivery_hash");

        vm.prank(address(mockWormholeRelayer)); // Use correct relayer
        vm.expectRevert("Not registered sender");
        wormholeReceiver.receiveWormholeMessages(payload, new bytes[](0), unauthorizedSourceAddress, sourceChain, deliveryHash);
    }

    function test_receiveWormholeMessages_revertsWhenUnregisteredChain() public {
        bytes memory payload = createBetPayload(1, keccak256("test_bet"), true, 100 ether, keccak256("commitment"));
        bytes32 sourceAddress = AZTEC_PREDICTION_CONTRACT; // Registered address
        uint16 unregisteredChain = 999; // Unregistered chain
        bytes32 deliveryHash = keccak256("delivery_hash");

        vm.prank(address(mockWormholeRelayer)); // Use correct relayer
        vm.expectRevert("Not registered sender");
        wormholeReceiver.receiveWormholeMessages(payload, new bytes[](0), sourceAddress, unregisteredChain, deliveryHash);
    }

    // ============ Payload Parsing Tests ============

    function test_payloadValidation_correctlyParsesAndValidatesBetData() public pure {
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

    function test_payloadValidation_handlesFalseOutcomeCorrectly() public pure {
        uint256 marketId = 1;
        bytes32 betId = keccak256("test_bet");
        bool outcome = false; // Test false outcome
        uint256 amount = 100 ether;
        bytes32 commitment = keccak256("test_commitment");

        bytes memory payload = createBetPayload(marketId, betId, outcome, amount, commitment);

        // Verify the outcome byte is correctly set to 0x00 for false
        uint8 outcomeByte;
        assembly {
            outcomeByte := byte(0, mload(add(payload, 96)))
        }
        assertEq(outcomeByte, 0x00);
    }

    function test_payloadValidation_handlesTrueOutcomeCorrectly() public pure {
        uint256 marketId = 1;
        bytes32 betId = keccak256("test_bet");
        bool outcome = true; // Test true outcome
        uint256 amount = 100 ether;
        bytes32 commitment = keccak256("test_commitment");

        bytes memory payload = createBetPayload(marketId, betId, outcome, amount, commitment);

        // Verify the outcome byte is correctly set to 0x01 for true
        uint8 outcomeByte;
        assembly {
            outcomeByte := byte(0, mload(add(payload, 96)))
        }
        assertEq(outcomeByte, 0x01);
    }

    // ============ Integration Tests ============

    function test_wormholeReceiver_connectsToPredictionMarketCorrectly() public {
        // Test that WormholeReceiver is properly configured
        assertEq(address(wormholeReceiver.PREDICTION_MARKET()), address(predictionMarket));

        // Test that it has access to market functions via inheritance
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Test market");

        // Verify market was created in the prediction market contract
        assertEq(predictionMarket.getMarketCount(), 1);
        assertEq(predictionMarket.getMarket(marketId).question, "Test market");

        // Test that WormholeReceiver has its own state separate from PredictionMarket
        assertEq(wormholeReceiver.getMarketCount(), 0);
    }

    function test_inheritedGetters_returnCorrectConfigurationValues() public {
        // Test that WormholeReceiver inherits from PredictionMarketGetters
        assertEq(wormholeReceiver.chainId(), WORMHOLE_CHAIN_ID);
        assertEq(wormholeReceiver.evmChainId(), EVM_CHAIN_ID);
        assertEq(wormholeReceiver.finality(), FINALITY);
        assertEq(address(wormholeReceiver.treasuryContract()), address(treasury));
    }

    // ============ Realistic Wormhole Message Receiver Tests ============

    function test_receiveWormholeMessages_processesValidCrossChainBet() public {
        // 1. Setup realistic test scenario
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Will ETH reach $5000 in 2024?");
        fundTreasury(2000 ether);

        // 2. Create realistic delivery parameters using official patterns
        (bytes memory payload, bytes32 deliveryHash, bytes32 betId, bytes32 commitment) =
            createDeliveryParams(marketId, "cross_chain_bet_test");

        // 3. Calculate realistic delivery cost and fund user
        uint256 deliveryCost = mockWormholeRelayer.quoteEVMDeliveryPrice(
            WORMHOLE_CHAIN_ID,
            0, // No receiver value
            DEFAULT_GAS_LIMIT
        );
        vm.deal(user1, deliveryCost + 1 ether);

        // 4. Execute realistic delivery via WormholeRelayer (not direct call)
        vm.prank(user1);
        mockWormholeRelayer.deliver{value: deliveryCost}(
            address(wormholeReceiver),
            payload,
            new bytes[](0), // No additional VAAs
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            deliveryHash,
            DEFAULT_GAS_LIMIT,
            0 // No receiver value
        );

        // 5. Verify realistic state changes
        assertTrue(mockWormholeRelayer.deliveryAttempted(deliveryHash));
        assertTrue(mockWormholeRelayer.deliverySucceeded(deliveryHash));
        assertTrue(wormholeReceiver.processedMessages(deliveryHash));
        assertTrue(predictionMarket.isProcessed(betId));
        assertEq(predictionMarket.getYesTotals(marketId), 100 ether);
    }

    function test_receiveWormholeMessages_handlesReceiverValuePayment() public {
        // 1. Setup market
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Receiver value test market");
        fundTreasury(1000 ether);

        // 2. Create delivery with receiver value (realistic Wormhole pattern)
        (bytes memory payload, bytes32 deliveryHash, bytes32 betId,) =
            createDeliveryParams(marketId, "receiver_value_test");

        // 3. Calculate delivery cost INCLUDING receiver value
        uint256 receiverValue = RECEIVER_VALUE; // 0.01 ETH to receiver
        uint256 deliveryCost = mockWormholeRelayer.quoteEVMDeliveryPrice(
            WORMHOLE_CHAIN_ID,
            receiverValue,
            DEFAULT_GAS_LIMIT
        );

        // 4. Fund relayer and user appropriately
        vm.deal(user1, deliveryCost + 1 ether);
        mockWormholeRelayer.fundRelayer{value: receiverValue}(); // Relayer needs funds for receiver value

        // 5. Execute delivery with receiver value
        uint256 receiverBalanceBefore = address(wormholeReceiver).balance;

        vm.prank(user1);
        mockWormholeRelayer.deliver{value: deliveryCost}(
            address(wormholeReceiver),
            payload,
            new bytes[](0),
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            deliveryHash,
            DEFAULT_GAS_LIMIT,
            receiverValue
        );

        // 6. Verify receiver got the ETH value (realistic Wormhole behavior)
        assertEq(address(wormholeReceiver).balance - receiverBalanceBefore, receiverValue);
        assertTrue(predictionMarket.isProcessed(betId));
    }

    function test_receiveWormholeMessages_failsWithInsufficientGas() public {
        // 1. Setup
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Gas limit test");
        fundTreasury(1000 ether);

        // 2. Create delivery with VERY low gas limit
        (bytes memory payload, bytes32 deliveryHash,,) =
            createDeliveryParams(marketId, "low_gas_test");

        uint256 lowGasLimit = MIN_GAS_LIMIT - 1; // Below minimum

        // 3. Try delivery with insufficient gas - should revert at relayer level
        vm.expectRevert("Gas limit too low");
        mockWormholeRelayer.deliver{value: 1 ether}(
            address(wormholeReceiver),
            payload,
            new bytes[](0),
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            deliveryHash,
            lowGasLimit,
            0
        );

        // 4. Verify delivery was never attempted
        assertFalse(mockWormholeRelayer.deliveryAttempted(deliveryHash));
    }

    function test_deliveryCostCalculation_matchesWormholeQuoting() public {
        // Test realistic Wormhole delivery cost calculations

        // 1. Test basic delivery cost
        uint256 basicCost = mockWormholeRelayer.quoteEVMDeliveryPrice(
            WORMHOLE_CHAIN_ID,
            0, // No receiver value
            DEFAULT_GAS_LIMIT
        );

        uint256 expectedBasicCost = mockWormholeRelayer.BASE_DELIVERY_COST() +
                                   (DEFAULT_GAS_LIMIT * mockWormholeRelayer.GAS_PRICE());
        assertEq(basicCost, expectedBasicCost);

        // 2. Test cost with receiver value
        uint256 receiverValue = 0.05 ether;
        uint256 costWithReceiver = mockWormholeRelayer.quoteEVMDeliveryPrice(
            WORMHOLE_CHAIN_ID,
            receiverValue,
            DEFAULT_GAS_LIMIT
        );
        assertEq(costWithReceiver, expectedBasicCost + receiverValue);

        // 3. Test high gas limit cost
        uint256 highGasCost = mockWormholeRelayer.quoteEVMDeliveryPrice(
            WORMHOLE_CHAIN_ID,
            0,
            HIGH_GAS_LIMIT
        );
        uint256 expectedHighCost = mockWormholeRelayer.BASE_DELIVERY_COST() +
                                  (HIGH_GAS_LIMIT * mockWormholeRelayer.GAS_PRICE());
        assertEq(highGasCost, expectedHighCost);
    }

    function test_endToEndDelivery_withRealisticWormholeFlow() public {
        // This test simulates the COMPLETE realistic Wormhole flow:
        // User sends from Aztec → Delivery Provider quotes → Pays → Delivers → Processes

        // 1. Market creation
        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("End-to-end realistic test");
        fundTreasury(5000 ether);

        // 2. Simulate multiple realistic deliveries
        string[3] memory testIds = ["bet_1", "bet_2", "bet_3"];
        uint256[3] memory amounts = [uint256(150 ether), uint256(200 ether), uint256(300 ether)];
        bool[3] memory outcomes = [true, false, true];

        for (uint256 i = 0; i < 3; i++) {
            // 2a. Create realistic delivery parameters for each bet
            bytes32 betId = keccak256(abi.encode(testIds[i], block.timestamp + i));
            bytes32 commitment = keccak256(abi.encode(marketId, "secret", testIds[i]));
            bytes memory payload = abi.encode(marketId, betId, outcomes[i], amounts[i], commitment);

            bytes32 deliveryHash = createRealisticDeliveryHash(
                AZTEC_CHAIN_ID,
                AZTEC_PREDICTION_CONTRACT,
                uint64(block.number + i),
                payload
            );

            // 2b. Quote and pay for delivery (realistic user flow)
            uint256 deliveryCost = mockWormholeRelayer.quoteEVMDeliveryPrice(
                WORMHOLE_CHAIN_ID, 0, DEFAULT_GAS_LIMIT
            );

            vm.deal(user1, deliveryCost + 1 ether);

            // 2c. Execute delivery
            vm.prank(user1);
            mockWormholeRelayer.deliver{value: deliveryCost}(
                address(wormholeReceiver),
                payload,
                new bytes[](0),
                AZTEC_PREDICTION_CONTRACT,
                AZTEC_CHAIN_ID,
                deliveryHash,
                DEFAULT_GAS_LIMIT,
                0
            );

            // 2d. Verify each delivery
            assertTrue(mockWormholeRelayer.deliverySucceeded(deliveryHash));
            assertTrue(predictionMarket.isProcessed(betId));
        }

        // 3. Verify final market state
        assertEq(predictionMarket.getYesTotals(marketId), 450 ether); // 150 + 300
        assertEq(predictionMarket.getNoTotals(marketId), 200 ether);   // 200

        // 4. Verify no replay possible (use the exact same delivery hash from first bet)
        bytes32 betId1 = keccak256(abi.encode(testIds[0], block.timestamp));
        bytes32 commitment1 = keccak256(abi.encode(marketId, "secret", testIds[0]));
        bytes memory replayPayload = abi.encode(marketId, betId1, outcomes[0], amounts[0], commitment1);
        bytes32 replayHash = createRealisticDeliveryHash(
            AZTEC_CHAIN_ID,
            AZTEC_PREDICTION_CONTRACT,
            uint64(block.number), // Same sequence as first delivery
            replayPayload
        );

        vm.expectRevert("Delivery already attempted");
        mockWormholeRelayer.deliver{value: 1 ether}(
            address(wormholeReceiver),
            replayPayload,
            new bytes[](0),
            AZTEC_PREDICTION_CONTRACT,
            AZTEC_CHAIN_ID,
            replayHash,
            DEFAULT_GAS_LIMIT,
            0
        );
    }
}