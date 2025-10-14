// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {PredictionMarketCore} from "../src/core/PredictionMarketCore.sol";
import {Treasury} from "../src/tokens/Treasury.sol";
import {WormholeReceiver} from "../src/wormhole/WormholeReceiver.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

/**
 * @title DeployPredictionMarket
 * @dev Foundry deployment script for the Prediction Market system
 *
 * Deploys and configures the complete prediction market system with proper ownership architecture:
 * Deployer → WormholeReceiver → PredictionMarketCore → Treasury
 *
 * Usage:
 *   # Local deployment (Anvil) - uses ANVIL_PRIVATE_KEY
 *   forge script script/DeployPredictionMarket.s.sol:DeployPredictionMarket \
 *     --rpc-url $ANVIL_RPC_URL \
 *     --private-key $ANVIL_PRIVATE_KEY \
 *     --broadcast
 *
 *   # OR use npm script
 *   npm run evm:deploy:local
 *
 *   # Arbitrum Sepolia testnet - uses TESTNET_PRIVATE_KEY
 *   forge script script/DeployPredictionMarket.s.sol:DeployPredictionMarket \
 *     --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
 *     --private-key $TESTNET_PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 *
 *   # OR use npm script
 *   npm run evm:deploy:testnet
 *
 * Environment variables (see .env.example):
 *   ANVIL_PRIVATE_KEY - Deployer key for local Anvil
 *   ANVIL_RPC_URL - Anvil RPC endpoint (default: http://localhost:8545)
 *   TESTNET_PRIVATE_KEY - Deployer key for Arbitrum Sepolia
 *   ARBITRUM_SEPOLIA_RPC_URL - Arbitrum Sepolia RPC endpoint
 *   AZTEC_EMITTER_ADDRESS - Aztec contract address for cross-chain messaging
 *
 * Optional overrides:
 *   WORMHOLE_ADDRESS - Override Wormhole Core contract address
 *   WORMHOLE_RELAYER_ADDRESS - Override WormholeRelayer address
 *   WORMHOLE_CHAIN_ID - Override Wormhole chain ID
 *   FINALITY - Override finality blocks
 *
 * Network Support:
 *   - Local Anvil (chain ID 31337): Mock token + mock Wormhole
 *   - Arbitrum Sepolia (chain ID 421614): Mock token + real Wormhole
 */
contract DeployPredictionMarket is Script {

    struct DeploymentAddresses {
        address mockErc20;
        address treasury;
        address predictionMarketCore;
        address wormholeReceiver;
    }

    function run() external returns (DeploymentAddresses memory) {
        uint256 deployerPrivateKey = _getDeployerPrivateKey();

        (address wormholeCoreAddress, uint16 wormholeChainId, uint8 finality, bytes32 aztecEmitter) = _getNetworkConfig();

        console.log("=== Prediction Market Deployment Configuration ===");
        console.log("Network:", _getNetworkName());
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Wormhole Core (VAA verification):", wormholeCoreAddress);
        console.log("Wormhole Chain ID:", wormholeChainId);
        console.log("Finality:", finality);
        console.log("Aztec Emitter:", aztecEmitter == bytes32(0) ? "NOT SET" : vm.toString(aztecEmitter));
        console.log("===================================================");
        console.log("NOTE: Using MANUAL VAA verification (no automatic Wormhole Relayer)");

        vm.startBroadcast(deployerPrivateKey);

        MockERC20 mockErc20 = new MockERC20("Mock USDC", "USDC", 6, 1_000_000_000 * 10**6);
        console.log("MockERC20 deployed to:", address(mockErc20));

        Treasury treasury = new Treasury(address(mockErc20));
        console.log("Treasury deployed to:", address(treasury));

        PredictionMarketCore predictionMarketCore = new PredictionMarketCore(
            wormholeChainId,
            block.chainid,
            finality,
            address(treasury)
        );
        console.log("PredictionMarketCore deployed to:", address(predictionMarketCore));

        WormholeReceiver wormholeReceiver = new WormholeReceiver(
            payable(wormholeCoreAddress),
            wormholeChainId,
            block.chainid,
            finality,
            address(treasury),
            address(predictionMarketCore)
        );
        console.log("WormholeReceiver deployed to:", address(wormholeReceiver));

        treasury.transferOwnership(address(predictionMarketCore));
        console.log("Treasury ownership transferred to PredictionMarketCore");

        predictionMarketCore.transferOwnership(address(wormholeReceiver));
        console.log("PredictionMarketCore ownership transferred to WormholeReceiver");

        if (aztecEmitter != bytes32(0)) {
            wormholeReceiver.setRegisteredSender(56, aztecEmitter);
            console.log("Registered Aztec sender:", vm.toString(aztecEmitter));
        } else {
            console.log("WARNING: No Aztec emitter address provided - must be set manually later");
        }

        vm.stopBroadcast();
        console.log("");
        console.log("=== Deployment Summary ===");
        if (address(mockErc20) != address(0)) {
            console.log("MockERC20 Contract:", address(mockErc20));
        }
        console.log("Treasury Contract:", address(treasury));
        console.log("[OK] PredictionMarketCore Contract:", address(predictionMarketCore));
        console.log("WormholeReceiver Contract:", address(wormholeReceiver));
        console.log("");
        console.log("=== Ownership Architecture ===");
        console.log("Treasury Owner:", address(predictionMarketCore));
        console.log("PredictionMarketCore Owner:", address(wormholeReceiver));
        console.log("WormholeReceiver Owner:", vm.addr(deployerPrivateKey));
        console.log("");
        if (aztecEmitter == bytes32(0)) {
            console.log("WARNING: Aztec emitter not registered. Set AZTEC_EMITTER_ADDRESS and call:");
            console.log("   wormholeReceiver.setRegisteredSender(56, <aztec_emitter_address>)");
        } else {
            console.log("Aztec emitter registered for chain ID 56");
        }

        console.log("=== Deployment Verification ===");
        address treasuryOwner = treasury.owner();
        address coreOwner = predictionMarketCore.owner();
        bool ownershipCorrect = (treasuryOwner == address(predictionMarketCore)) && (coreOwner == address(wormholeReceiver));

        if (ownershipCorrect) {
            console.log("[PASS] Verification PASSED: Ownership chain configured correctly");
        } else {
            console.log("[FAIL] Verification FAILED: Ownership chain incorrect");
            console.log("  Treasury owner:", treasuryOwner);
            console.log("  Expected:", address(predictionMarketCore));
            console.log("  Core owner:", coreOwner);
            console.log("  Expected:", address(wormholeReceiver));
        }
        console.log("Deployment completed successfully!");

        return DeploymentAddresses({
            mockErc20: address(mockErc20),
            treasury: address(treasury),
            predictionMarketCore: address(predictionMarketCore),
            wormholeReceiver: address(wormholeReceiver)
        });
    }

    /**
     * @dev Get deployer private key based on chain ID
     * Auto-detects whether to use ANVIL_PRIVATE_KEY or TESTNET_PRIVATE_KEY
     */
    function _getDeployerPrivateKey() internal view returns (uint256) {
        if (block.chainid == 31337) {
            return vm.envUint("ANVIL_PRIVATE_KEY");
        } else if (block.chainid == 421614) {
            return vm.envUint("TESTNET_PRIVATE_KEY");
        } else {
            revert(string.concat("Unsupported chain ID: ", vm.toString(block.chainid)));
        }
    }

    /**
     * @dev Get human-readable network name
     */
    function _getNetworkName() internal view returns (string memory) {
        if (block.chainid == 31337) {
            return "Local Anvil";
        } else if (block.chainid == 421614) {
            return "Arbitrum Sepolia";
        } else {
            return "Unknown";
        }
    }

    /**
     * @dev Get network-specific configuration based on chain ID
     * Returns Wormhole Core address (manual VAA verification, no Relayer)
     */
    function _getNetworkConfig() internal view returns (
        address wormholeCoreAddress,
        uint16 wormholeChainId,
        uint8 finality,
        bytes32 aztecEmitter
    ) {
        if (block.chainid == 31337) {
            // Local Anvil - mock addresses for testing
            wormholeCoreAddress = 0xC89Ce4735882C9F0f0FE26686c53074E09B0D550;
            wormholeChainId = 10003;
            finality = 2;
            aztecEmitter = 0x0f8a2300a7925c586135b1c142dc0b833f20d5c41ea6e815900d65d041e96cf5;
        } else if (block.chainid == 421614) {
            // Arbitrum Sepolia - official Wormhole Core address
            wormholeCoreAddress = vm.envOr("WORMHOLE_CORE_ADDRESS", address(0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35));
            wormholeChainId = uint16(vm.envOr("WORMHOLE_CHAIN_ID", uint256(10003)));
            finality = uint8(vm.envOr("FINALITY", uint256(2)));
            aztecEmitter = vm.envOr("AZTEC_EMITTER_ADDRESS", bytes32(0x19898ea9cd3f19e20a95d5a9448a7b0e9b4eb3ce2c9daa1d4f4606344997e014));
        } else {
            revert(string.concat("Unsupported chain ID: ", vm.toString(block.chainid), " (only local and testnet supported)"));
        }
    }

}