// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PredictionMarketCore} from "../../src/core/PredictionMarketCore.sol";
import {Treasury} from "../../src/tokens/Treasury.sol";
import {WormholeReceiver} from "../../src/wormhole/WormholeReceiver.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

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

/**
 * @title MockWormholeRelayer
 * @dev Realistic mock of WormholeRelayer that simulates actual delivery behavior
 * Based on official Wormhole documentation and demo patterns
 */
contract MockWormholeRelayer {
    // State tracking exactly like real WormholeRelayer
    mapping(bytes32 => bool) public deliveryAttempted;
    mapping(bytes32 => bool) public deliverySucceeded;

    // Realistic pricing constants (based on Wormhole docs)
    uint256 public constant BASE_DELIVERY_COST = 0.001 ether;
    uint256 public constant GAS_PRICE = 20 gwei;
    uint256 public constant DELIVERY_OVERHEAD_GAS = 50000;

    // Events matching real WormholeRelayer
    event DeliveryAttempted(bytes32 indexed deliveryHash, address indexed targetContract);
    event DeliverySuccess(bytes32 indexed deliveryHash, address indexed targetContract);
    event DeliveryFailure(bytes32 indexed deliveryHash, address indexed targetContract, string reason);

    /**
     * @dev Simulates real WormholeRelayer.deliver() behavior exactly
     * This replicates what delivery providers do in production
     */
    function deliver(
        address targetContract,
        bytes memory payload,
        bytes[] memory additionalVaas,
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32 deliveryHash,
        uint256 gasLimit,
        uint256 receiverValue
    ) external payable {
        // 1. Validate inputs (real relayer checks)
        require(targetContract != address(0), "Invalid target contract");
        require(gasLimit >= 100000, "Gas limit too low"); // Minimum viable gas
        require(gasLimit <= 2000000, "Gas limit too high"); // Prevent abuse

        // 2. Check delivery attempt status (critical for replay protection)
        require(!deliveryAttempted[deliveryHash], "Delivery already attempted");

        // 3. Calculate and validate payment (exactly like real relayer)
        uint256 requiredCost = quoteEvmDeliveryPrice(0, receiverValue, gasLimit);
        require(msg.value >= requiredCost, "Insufficient payment for delivery");

        // 4. Mark delivery as attempted BEFORE execution (real relayer behavior)
        deliveryAttempted[deliveryHash] = true;
        emit DeliveryAttempted(deliveryHash, targetContract);

        // 5. Prepare call data exactly as real relayer does
        bytes memory callData = abi.encodeWithSignature(
            "receiveWormholeMessages(bytes,bytes[],bytes32,uint16,bytes32)",
            payload,
            additionalVaas,
            sourceAddress,
            sourceChain,
            deliveryHash
        );

        // 6. Execute delivery with precise gas accounting
        bool success;
        bytes memory returnData;

        // Add receiver value if specified (real relayer forwards ETH)
        if (receiverValue > 0) {
            require(address(this).balance >= receiverValue, "Insufficient relayer balance");
            (success, returnData) = targetContract.call{
                gas: gasLimit - DELIVERY_OVERHEAD_GAS, // Account for overhead
                value: receiverValue
            }(callData);
        } else {
            (success, returnData) = targetContract.call{
                gas: gasLimit - DELIVERY_OVERHEAD_GAS
            }(callData);
        }

        // 7. Handle result exactly like real relayer
        if (success) {
            deliverySucceeded[deliveryHash] = true;
            emit DeliverySuccess(deliveryHash, targetContract);
        } else {
            // Real relayer still marks as attempted even on failure
            string memory revertReason = _extractRevertReason(returnData);
            emit DeliveryFailure(deliveryHash, targetContract, revertReason);
            // Note: We don't revert here - real relayer continues
        }
    }

    /**
     * @dev Quote delivery cost exactly like real WormholeRelayer.quoteEVMDeliveryPrice()
     */
    function quoteEvmDeliveryPrice(
        uint16 /* targetChain */,
        uint256 receiverValue,
        uint256 gasLimit
    ) public pure returns (uint256 nativePriceQuote) {
        // Formula based on real Wormhole relayer pricing
        uint256 gasCost = gasLimit * GAS_PRICE;
        uint256 totalCost = BASE_DELIVERY_COST + gasCost + receiverValue;
        return totalCost;
    }

    /**
     * @dev Check if delivery was attempted (public view like real relayer)
     */
    function deliveryAttemptedPreviously(bytes32 deliveryHash) external view returns (bool) {
        return deliveryAttempted[deliveryHash];
    }

    /**
     * @dev Extract revert reason from return data
     */
    function _extractRevertReason(bytes memory returnData) internal pure returns (string memory) {
        if (returnData.length < 68) {
            return "Transaction reverted without reason";
        }

        // Extract revert reason from ABI encoded error
        assembly {
            returnData := add(returnData, 0x04)
        }
        return abi.decode(returnData, (string));
    }

    // Allow receiving ETH for receiver value functionality
    receive() external payable {}

    // Emergency function to fund relayer for tests
    function fundRelayer() external payable {}
}

contract IntegrationBase is Test {
    // Realistic Wormhole constants (based on official docs)
    uint16 internal constant WORMHOLE_CHAIN_ID = 10003; // Arbitrum Sepolia
    uint256 internal constant EVM_CHAIN_ID = 31337; // Local test chain (matches vm.chainId)
    uint8 internal constant FINALITY = 1;
    uint16 internal constant AZTEC_CHAIN_ID = 56; // Official Aztec Wormhole chain ID

    // Realistic source addresses (simulating deployed Aztec contracts)
    bytes32 internal constant AZTEC_PREDICTION_CONTRACT = 0x0f8a2300a7925c586135b1c142dc0b833f20d5c41ea6e815900d65d041e96cf5;

    // Realistic delivery parameters
    uint256 internal constant DEFAULT_GAS_LIMIT = 300000;
    uint256 internal constant MIN_GAS_LIMIT = 100000;
    uint256 internal constant HIGH_GAS_LIMIT = 500000;
    uint256 internal constant RECEIVER_VALUE = 0.01 ether;

    // Test users
    address internal admin = makeAddr("admin");
    address internal user1 = makeAddr("user1");
    address internal user2 = makeAddr("user2");
    address internal owner = makeAddr("owner");

    // Contracts
    MockWormhole internal mockWormhole;
    MockWormholeRelayer internal mockWormholeRelayer;
    MockERC20 internal mockErc20;
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

        // Deploy realistic mock WormholeRelayer
        mockWormholeRelayer = new MockWormholeRelayer();

        // Deploy MockERC20 (USDC-like token with 6 decimals)
        mockErc20 = new MockERC20("Mock USDC", "USDC", 6, 1_000_000_000 * 10**6); // 1B initial supply

        // Deploy Treasury with MockERC20
        treasury = new Treasury(address(mockErc20));

        // Deploy PredictionMarketCore
        predictionMarket = new PredictionMarketCore(
            payable(address(mockWormhole)),
            WORMHOLE_CHAIN_ID,
            EVM_CHAIN_ID,
            FINALITY,
            address(treasury)
        );

        // Deploy WormholeReceiver with realistic relayer
        wormholeReceiver = new WormholeReceiver(
            payable(address(mockWormhole)),
            address(mockWormholeRelayer), // Use realistic relayer mock
            WORMHOLE_CHAIN_ID,
            EVM_CHAIN_ID,
            FINALITY,
            address(treasury),
            address(predictionMarket)
        );

        // Register realistic Aztec senders
        wormholeReceiver.setRegisteredSender(AZTEC_CHAIN_ID, AZTEC_PREDICTION_CONTRACT);

        // Transfer ownership of PredictionMarketCore to WormholeReceiver
        predictionMarket.transferOwnership(address(wormholeReceiver));

        // Transfer ownership of Treasury to PredictionMarketCore (so it can transfer payouts)
        treasury.transferOwnership(address(predictionMarket));

        // Fund the mock relayer for realistic tests
        vm.deal(address(mockWormholeRelayer), 10 ether);

        // Mint MockERC20 to test users
        mockErc20.mint(user1, 10_000 * 10**6); // 10k USDC
        mockErc20.mint(user2, 10_000 * 10**6); // 10k USDC
        mockErc20.mint(owner, 100_000 * 10**6); // 100k USDC

        vm.stopPrank();

        // Calculate test commitment
        testCommitment = keccak256(abi.encodePacked(uint256(1), testSecret));
    }

    // Helper function to create realistic bet payload (structured like Wormhole demos)
    function createRealisticBetPayload(
        uint256 marketId,
        bytes32 betId,
        bool outcome,
        uint256 amount,
        bytes32 commitment
    ) internal pure returns (bytes memory) {
        // Use abi.encode like official Wormhole demos for proper structure
        return abi.encode(marketId, betId, outcome, amount, commitment);
    }

    // Legacy helper (kept for compatibility)
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

    /**
     * @dev Create realistic delivery hash exactly like real Wormhole relayers
     * Based on official Wormhole patterns
     */
    function createRealisticDeliveryHash(
        uint16 sourceChain,
        bytes32 sourceAddress,
        uint64 sequence,
        bytes memory payload
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(sourceChain, sourceAddress, sequence, keccak256(payload)));
    }

    /**
     * @dev Create realistic delivery parameters for tests
     */
    function createDeliveryParams(
        uint256 marketId,
        string memory testIdentifier
    ) internal view returns (
        bytes memory payload,
        bytes32 deliveryHash,
        bytes32 betId,
        bytes32 commitment
    ) {
        // Create realistic bet data
        betId = keccak256(abi.encode(testIdentifier, block.timestamp));
        commitment = keccak256(abi.encode(marketId, "user_secret", testIdentifier));

        // Create structured payload
        payload = abi.encode(marketId, betId, true, 100 ether, commitment);

        // Create realistic delivery hash
        deliveryHash = createRealisticDeliveryHash(
            AZTEC_CHAIN_ID,
            AZTEC_PREDICTION_CONTRACT,
            uint64(block.number), // Use block number as sequence
            payload
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

    // Helper to fund Treasury with MockERC20
    function fundTreasury(uint256 marketId, address from, uint256 amount) internal {
        vm.startPrank(from);
        mockErc20.approve(address(treasury), amount);
        vm.stopPrank();

        vm.prank(address(predictionMarket));
        treasury.deposit(marketId, from, amount);
    }
}