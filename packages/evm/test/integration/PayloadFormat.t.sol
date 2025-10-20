// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IntegrationBase} from "./IntegrationBase.sol";

/**
 * @title PayloadFormatTest
 * @notice Tests to validate payload encoding/decoding between Aztec (Noir) and Solidity (EVM)
 * @dev These tests ensure that payloads encoded in Aztec using big-endian (to_be_bytes)
 *      are correctly decoded in Solidity's WormholeReceiver contract.
 *
 * Key Validations:
 * - BET payload (98 bytes): type(1) | marketId(32) | betId(32) | outcome(1) | amount(32)
 * - CLAIM payload (129 bytes): type(1) | marketId(32) | nullifier(32) | betAmount(32) | recipientField(32)
 * - Correct extraction of address from recipientField (32 bytes → 20 bytes)
 * - Rejection of malformed payloads
 */
contract PayloadFormatTest is IntegrationBase {
    uint256 marketId;
    uint256 constant TOTAL_POOL = 1000 * 10**6;
    uint256 constant EXPIRES_AT_OFFSET = 1 days;

    function setUp() public virtual override {
        super.setUp();

        // Create a market for testing
        vm.startPrank(address(wormholeReceiver));
        mockErc20.mint(address(wormholeReceiver), TOTAL_POOL);
        mockErc20.approve(address(treasury), TOTAL_POOL);
        marketId = predictionMarket.createMarket("Test Market", TOTAL_POOL, block.timestamp + EXPIRES_AT_OFFSET);
        vm.stopPrank();
    }

    // ============================================
    // BET Payload Tests (Type 0x01)
    // ============================================

    /**
     * @notice Tests that BET payload encoded in big-endian (as Aztec does) is correctly decoded
     * @dev Simulates exact encoding from Aztec's create_bet_payload function
     */
    function test_betPayload_encodingMatchesAztecFormat() public {
        // Aztec encoding parameters
        uint256 testMarketId = marketId;
        bytes32 testBetId = keccak256("test_bet_1");
        bool testOutcome = true; // YES
        uint256 testAmount = 250 * 10**6; // 250 USDC

        // Encode exactly as Aztec does (big-endian with abi.encodePacked)
        // Aztec: to_be_bytes() produces big-endian bytes
        // Solidity: abi.encodePacked with uint256/bytes32 produces big-endian bytes
        bytes memory aztecStylePayload = abi.encodePacked(
            uint8(0x01),        // Message type: BET
            testMarketId,       // 32 bytes big-endian
            testBetId,          // 32 bytes
            uint8(testOutcome ? 1 : 0), // 1 byte (0x00 or 0x01)
            testAmount          // 32 bytes big-endian
        );

        // Verify payload length
        assertEq(aztecStylePayload.length, 98, "BET payload should be exactly 98 bytes");

        // Create VAA and process
        bytes memory vaa = createMockVaa(aztecStylePayload);
        wormholeReceiver.verify(vaa);

        // Verify market state was updated correctly
        (, , , uint256 yesTotal, uint256 noTotal, , , , ) = predictionMarket.getMarket(testMarketId);

        if (testOutcome) {
            assertEq(yesTotal, testAmount, "yesTotal should match bet amount");
            assertEq(noTotal, 0, "noTotal should be 0");
        } else {
            assertEq(noTotal, testAmount, "noTotal should match bet amount");
            assertEq(yesTotal, 0, "yesTotal should be 0");
        }
    }

    /**
     * @notice Tests that BET payload with invalid length is rejected
     */
    function test_betPayload_invalidLength_reverts() public {
        // Create payload with wrong length (97 bytes instead of 98)
        bytes memory invalidPayload = abi.encodePacked(
            uint8(0x01),
            uint256(marketId),
            keccak256("bet1"),
            uint8(1)
            // Missing amount field
        );

        bytes memory vaa = createMockVaa(invalidPayload);

        vm.expectRevert();
        wormholeReceiver.verify(vaa);
    }

    /**
     * @notice Tests multiple BET payloads to ensure consistent decoding
     */
    function test_betPayload_multipleBets_decodedCorrectly() public {
        // Process multiple bets with different values
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100 * 10**6;
        amounts[1] = 200 * 10**6;
        amounts[2] = 150 * 10**6;

        uint256 expectedYesTotal = 0;
        uint256 expectedNoTotal = 0;

        for (uint256 i = 0; i < amounts.length; i++) {
            bool outcome = (i % 2 == 0); // Alternate YES/NO
            bytes32 betId = keccak256(abi.encodePacked("bet", i));

            bytes memory payload = abi.encodePacked(
                uint8(0x01),
                marketId,
                betId,
                uint8(outcome ? 1 : 0),
                amounts[i]
            );

            wormholeReceiver.verify(createMockVaa(payload));

            if (outcome) {
                expectedYesTotal += amounts[i];
            } else {
                expectedNoTotal += amounts[i];
            }
        }

        // Verify totals
        (, , , uint256 yesTotal, uint256 noTotal, , , , ) = predictionMarket.getMarket(marketId);
        assertEq(yesTotal, expectedYesTotal, "yesTotal mismatch");
        assertEq(noTotal, expectedNoTotal, "noTotal mismatch");
    }

    // ============================================
    // CLAIM Payload Tests (Type 0x02)
    // ============================================

    /**
     * @notice Tests that CLAIM payload with recipientField (32 bytes) is correctly decoded
     * @dev Validates extraction of 20-byte address from 32-byte Field
     */
    function test_claimPayload_encodingMatchesAztecFormat() public {
        // Setup: Process bet and resolve market
        bytes32 betId = keccak256("winning_bet");
        uint256 betAmount = 150 * 10**6;

        bytes memory betPayload = abi.encodePacked(
            uint8(0x01),
            marketId,
            betId,
            uint8(1), // YES
            betAmount
        );
        wormholeReceiver.verify(createMockVaa(betPayload));

        // Resolve market
        vm.warp(block.timestamp + EXPIRES_AT_OFFSET + 1);
        vm.prank(address(wormholeReceiver));
        predictionMarket.resolveMarket(marketId, true); // YES wins

        // Prepare CLAIM payload
        bytes32 nullifier = keccak256("test_nullifier");
        address recipient = user1;

        // Convert address to recipientField (32 bytes with address in last 20 bytes)
        // This simulates how Aztec converts AztecAddress.to_field().to_be_bytes()
        bytes32 recipientField = bytes32(uint256(uint160(recipient)));

        // Encode CLAIM payload exactly as Aztec does
        bytes memory aztecStyleClaimPayload = abi.encodePacked(
            uint8(0x02),        // Message type: CLAIM_AUTH
            marketId,           // 32 bytes
            nullifier,          // 32 bytes
            betAmount,          // 32 bytes
            recipientField      // 32 bytes (address in last 20 bytes)
        );

        // Verify payload length
        assertEq(aztecStyleClaimPayload.length, 129, "CLAIM payload should be exactly 129 bytes");

        // Process claim
        uint256 balanceBefore = mockErc20.balanceOf(recipient);
        wormholeReceiver.verify(createMockVaa(aztecStyleClaimPayload));
        uint256 balanceAfter = mockErc20.balanceOf(recipient);

        // Winner should receive full pool (only one bettor)
        assertEq(balanceAfter - balanceBefore, TOTAL_POOL, "Recipient should receive payout");
    }

    /**
     * @notice Tests correct extraction of address from recipientField
     * @dev Validates that the last 20 bytes of the 32-byte Field are correctly extracted
     */
    function test_claimPayload_recipientFieldExtraction() public {
        // Test address conversion with various addresses
        address[] memory testAddresses = new address[](3);
        testAddresses[0] = address(0x1234567890123456789012345678901234567890);
        testAddresses[1] = address(0xabCDeF0123456789AbcdEf0123456789aBCDEF01);
        testAddresses[2] = user2;

        for (uint256 i = 0; i < testAddresses.length; i++) {
            address originalAddress = testAddresses[i];

            // Convert address to recipientField (32 bytes)
            bytes32 recipientField = bytes32(uint256(uint160(originalAddress)));

            // Verify the recipientField has correct structure:
            // - First 12 bytes should be zero
            // - Last 20 bytes should be the address
            bytes memory fieldBytes = abi.encodePacked(recipientField);

            // Extract address using the same method as WormholeReceiver
            address extractedAddress;
            assembly {
                let field := mload(add(fieldBytes, 32))
                extractedAddress := and(field, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            }

            // Verify extraction matches original
            assertEq(extractedAddress, originalAddress, "Address extraction mismatch");

            // Verify first 12 bytes are zero
            uint256 fieldAsUint = uint256(recipientField);
            uint256 maskedHighBytes = fieldAsUint >> 160; // Remove last 160 bits (20 bytes)
            assertEq(maskedHighBytes, 0, "High bytes should be zero");
        }

        // Now test actual claim with one of the addresses
        bytes32 betId = keccak256("bet_for_extraction_test");
        uint256 betAmount = 100 * 10**6;
        address testRecipient = testAddresses[0];

        wormholeReceiver.verify(createMockVaa(abi.encodePacked(
            uint8(0x01), marketId, betId, uint8(1), betAmount
        )));

        vm.warp(block.timestamp + EXPIRES_AT_OFFSET + 1);
        vm.prank(address(wormholeReceiver));
        predictionMarket.resolveMarket(marketId, true);

        bytes32 nullifier = keccak256("extraction_test_nullifier");
        bytes32 recipientField = bytes32(uint256(uint160(testRecipient)));

        bytes memory claimPayload = abi.encodePacked(
            uint8(0x02),
            marketId,
            nullifier,
            betAmount,
            recipientField
        );

        uint256 balanceBefore = mockErc20.balanceOf(testRecipient);
        wormholeReceiver.verify(createMockVaa(claimPayload));
        uint256 balanceAfter = mockErc20.balanceOf(testRecipient);

        assertGt(balanceAfter, balanceBefore, "Recipient should receive payout");
    }

    /**
     * @notice Tests that CLAIM payload with invalid length is rejected
     */
    function test_claimPayload_invalidLength_reverts() public {
        // Create payload with wrong length (missing recipientField)
        bytes memory invalidPayload = abi.encodePacked(
            uint8(0x02),
            marketId,
            keccak256("nullifier1"),
            uint256(100 * 10**6)
            // Missing recipientField
        );

        bytes memory vaa = createMockVaa(invalidPayload);

        vm.expectRevert();
        wormholeReceiver.verify(vaa);
    }

    /**
     * @notice Tests that recipientField with all zeros is rejected
     */
    function test_claimPayload_zeroRecipient_reverts() public {
        // Setup
        bytes32 betId = keccak256("bet1");
        wormholeReceiver.verify(createMockVaa(abi.encodePacked(
            uint8(0x01), marketId, betId, uint8(1), uint256(100 * 10**6)
        )));

        vm.warp(block.timestamp + EXPIRES_AT_OFFSET + 1);
        vm.prank(address(wormholeReceiver));
        predictionMarket.resolveMarket(marketId, true);

        // Create CLAIM with zero recipientField
        bytes memory claimPayload = abi.encodePacked(
            uint8(0x02),
            marketId,
            keccak256("nullifier1"),
            uint256(100 * 10**6),
            bytes32(0) // Zero recipientField → address(0)
        );

        vm.expectRevert();
        wormholeReceiver.verify(createMockVaa(claimPayload));
    }
}
