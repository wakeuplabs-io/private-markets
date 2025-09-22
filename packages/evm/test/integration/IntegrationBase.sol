// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PredictionMarketCore} from "../../src/core/PredictionMarketCore.sol";
import {Treasury} from "../../src/tokens/Treasury.sol";
import {WormholeReceiver} from "../../src/wormhole/WormholeReceiver.sol";

import {IWormhole} from "wormhole-foundation/ethereum/contracts/interfaces/IWormhole.sol";

// Mock Wormhole for testing
contract MockWormhole {
    function parseAndVerifyVm(bytes memory) external view returns (IWormhole.VM memory vm, bool valid, string memory reason) {
        // Mock implementation - returns valid for testing
        vm = IWormhole.VM({
            version: 1,
            timestamp: uint32(block.timestamp),
            nonce: 1,
            emitterChainId: 56, // Aztec chain ID
            emitterAddress: bytes32(uint256(0x1234)),
            sequence: 1,
            consistencyLevel: 200,
            payload: "",
            guardianSetIndex: 0,
            signatures: new IWormhole.Signature[](0),
            hash: bytes32(0)
        });
        valid = true;
        reason = "";
    }
}

contract IntegrationBase is Test {
    // Constants
    uint16 internal constant WORMHOLE_CHAIN_ID = 10003; // Arbitrum Sepolia
    uint256 internal constant EVM_CHAIN_ID = 31337; // Local test chain (matches vm.chainId)
    uint8 internal constant FINALITY = 1;
    uint16 internal constant AZTEC_CHAIN_ID = 56;

    // Test users
    address internal admin = makeAddr("admin");
    address internal user1 = makeAddr("user1");
    address internal user2 = makeAddr("user2");
    address internal owner = makeAddr("owner");

    // Contracts
    MockWormhole internal mockWormhole;
    Treasury internal treasury;
    PredictionMarketCore internal predictionMarket;
    WormholeReceiver internal wormholeReceiver;

    // Test data
    string internal testQuestion = "Will it rain tomorrow?";
    bytes32 internal testSecret = bytes32("user_secret");
    bytes32 internal testCommitment;

    function setUp() public virtual {
        vm.startPrank(owner);

        // Deploy mock Wormhole
        mockWormhole = new MockWormhole();

        // Deploy Treasury
        treasury = new Treasury("Prediction Market Token", "PMT", 0);

        // Deploy PredictionMarketCore
        predictionMarket = new PredictionMarketCore(
            payable(address(mockWormhole)),
            WORMHOLE_CHAIN_ID,
            EVM_CHAIN_ID,
            FINALITY,
            address(treasury)
        );

        // Deploy WormholeReceiver
        wormholeReceiver = new WormholeReceiver(
            payable(address(mockWormhole)),
            WORMHOLE_CHAIN_ID,
            EVM_CHAIN_ID,
            FINALITY,
            address(treasury),
            address(predictionMarket)
        );

        // Register Aztec emitter
        wormholeReceiver.registerEmitter(AZTEC_CHAIN_ID, bytes32(uint256(0x1234)));

        // Transfer ownership of PredictionMarketCore to WormholeReceiver
        predictionMarket.transferOwnership(address(wormholeReceiver));

        // Transfer ownership of Treasury to PredictionMarketCore (so it can mint tokens)
        treasury.transferOwnership(address(predictionMarket));

        vm.stopPrank();

        // Calculate test commitment
        testCommitment = keccak256(abi.encodePacked(uint256(1), testSecret));
    }

    // Helper function to create a VAA payload for betting
    function createBetPayload(
        uint256 marketId,
        bytes32 betId,
        bool outcome,
        uint256 amount,
        bytes32 commitment
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            marketId,    // 32 bytes
            betId,       // 32 bytes
            outcome,     // 1 byte
            amount,      // 32 bytes
            commitment   // 32 bytes
        );
    }

    // Helper function to create mock VAA
    function createMockVaa(bytes memory payload) internal pure returns (bytes memory) {
        // Simple mock VAA structure - in real tests you'd create proper VAA format
        return payload;
    }

    // Helper function to create Merkle proof (simplified)
    function createMerkleProof(bytes32 leaf, bytes32 /* root */) internal pure returns (bytes32[] memory proof) {
        proof = new bytes32[](1);
        proof[0] = leaf; // Simplified single-element proof
    }

    // Helper to fund contract with tokens
    function fundTreasury(uint256 amount) internal {
        vm.prank(address(predictionMarket));
        treasury.mint(address(treasury), amount);
    }
}