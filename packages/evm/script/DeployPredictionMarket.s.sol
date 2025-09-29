// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {PredictionMarketCore} from "../src/core/PredictionMarketCore.sol";
import {Treasury} from "../src/tokens/Treasury.sol";
import {WormholeReceiver} from "../src/wormhole/WormholeReceiver.sol";
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
 *   # Local deployment (Anvil)
 *   forge script script/DeployPredictionMarket.s.sol --fork-url http://localhost:8545 --broadcast
 *
 *   # Arbitrum Sepolia testnet deployment
 *   forge script script/DeployPredictionMarket.s.sol --fork-url $ARBITRUM_SEPOLIA_RPC_URL --broadcast
 *
 * Required environment variables:
 *   PRIVATE_KEY - Deployer private key
 *
 * Optional environment variables:
 *   WORMHOLE_ADDRESS - Override Wormhole Core contract address (default: official addresses)
 *   WORMHOLE_RELAYER_ADDRESS - Override WormholeRelayer address (default: official addresses)
 *   AZTEC_EMITTER_ADDRESS - Aztec contract address for cross-chain messaging (required for production)
 *   WORMHOLE_CHAIN_ID - Override Wormhole chain ID (default: 10003 for Arbitrum Sepolia)
 *   FINALITY - Override finality blocks (default: 2)
 *
 * Network Support:
 *   - Local Anvil (chain ID 31337): Mock addresses for testing
 *   - Arbitrum Sepolia (chain ID 421614): Official Wormhole addresses
 *   - Arbitrum Mainnet (chain ID 42161): Official Wormhole addresses
 */
contract DeployPredictionMarket is Script {

    struct DeploymentAddresses {
        address treasury;
        address predictionMarketCore;
        address wormholeReceiver;
    }

    function run() external returns (DeploymentAddresses memory) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Network-specific configuration based on chain ID
        (address wormholeAddress, uint16 wormholeChainId, uint8 finality, bytes32 aztecEmitter) = _getNetworkConfig();

        console.log("=== Prediction Market Deployment Configuration ===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Wormhole Address:", wormholeAddress);
        console.log("Wormhole Relayer Address:", _getWormholeRelayerAddress());
        console.log("Wormhole Chain ID:", wormholeChainId);
        console.log("Finality:", finality);
        console.log("Aztec Emitter:", aztecEmitter == bytes32(0) ? "NOT SET" : vm.toString(aztecEmitter));
        console.log("===================================================");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Treasury contract
        Treasury treasury = new Treasury(
            "Prediction Market Token",
            "PMT",
            0 // Start with 0 supply, mint on demand
        );
        console.log("Treasury deployed to:", address(treasury));

        // 2. Deploy PredictionMarketCore contract
        PredictionMarketCore predictionMarketCore = new PredictionMarketCore(
            payable(wormholeAddress),
            wormholeChainId,
            block.chainid,
            finality,
            address(treasury)
        );
        console.log("PredictionMarketCore deployed to:", address(predictionMarketCore));

        // 3. Deploy WormholeReceiver contract
        address wormholeRelayerAddress = _getWormholeRelayerAddress();
        WormholeReceiver wormholeReceiver = new WormholeReceiver(
            payable(wormholeAddress),
            wormholeRelayerAddress,
            wormholeChainId,
            block.chainid,
            finality,
            address(treasury),
            address(predictionMarketCore)
        );
        console.log("WormholeReceiver deployed to:", address(wormholeReceiver));

        // 4. Set up ownership architecture: owner → WormholeReceiver → PredictionMarketCore → Treasury

        // Transfer Treasury ownership to PredictionMarketCore so it can mint/transfer tokens
        treasury.transferOwnership(address(predictionMarketCore));
        console.log("Treasury ownership transferred to PredictionMarketCore");

        // Transfer PredictionMarketCore ownership to WormholeReceiver so it can process cross-chain bets
        predictionMarketCore.transferOwnership(address(wormholeReceiver));
        console.log("PredictionMarketCore ownership transferred to WormholeReceiver");

        // Register Aztec sender in WormholeReceiver (only if emitter address is provided)
        if (aztecEmitter != bytes32(0)) {
            wormholeReceiver.setRegisteredSender(56, aztecEmitter); // 56 = Aztec Wormhole Chain ID
            console.log("Registered Aztec sender:", vm.toString(aztecEmitter));
        } else {
            console.log("WARNING: No Aztec emitter address provided - must be set manually later");
        }

        vm.stopBroadcast();
        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("Treasury Contract:", address(treasury));
        console.log("PredictionMarketCore Contract:", address(predictionMarketCore));
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

        // Verify deployment by checking initial market count (should be 0)
        uint256 initialMarketCount = predictionMarketCore.getMarketCount();
        console.log("=== Deployment Verification ===");
        console.log("Initial market count:", initialMarketCount);
        if (initialMarketCount == 0) {
            console.log("[PASS] Verification PASSED: Market count is 0 as expected");
        } else {
            console.log("[FAIL] Verification FAILED: Market count should be 0");
        }
        console.log("Deployment completed successfully!");

        return DeploymentAddresses({
            treasury: address(treasury),
            predictionMarketCore: address(predictionMarketCore),
            wormholeReceiver: address(wormholeReceiver)
        });
    }

    /**
     * @dev Get network-specific configuration based on chain ID
     */
    function _getNetworkConfig() internal view returns (
        address wormholeAddress,
        uint16 wormholeChainId,
        uint8 finality,
        bytes32 aztecEmitter
    ) {
        if (block.chainid == 31337) {
            // Local Anvil - well-known addresses
            wormholeAddress = 0xC89Ce4735882C9F0f0FE26686c53074E09B0D550;
            wormholeChainId = 10003;
            finality = 2;
            aztecEmitter = 0x0f8a2300a7925c586135b1c142dc0b833f20d5c41ea6e815900d65d041e96cf5;
        } else if (block.chainid == 421614) {
            // Arbitrum Sepolia - official Wormhole addresses (can override via env vars)
            wormholeAddress = vm.envOr("WORMHOLE_ADDRESS", address(0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35));
            wormholeChainId = uint16(vm.envOr("WORMHOLE_CHAIN_ID", uint256(10003))); // Official Arbitrum Sepolia Wormhole Chain ID
            finality = uint8(vm.envOr("FINALITY", uint256(2)));
            aztecEmitter = vm.envOr("AZTEC_EMITTER_ADDRESS", bytes32(0)); // Must be provided for production
        } else {
            revert(string.concat("Unsupported chain ID: ", vm.toString(block.chainid), " (only local and testnet supported)"));
        }
    }

    /**
     * @dev Get WormholeRelayer address based on chain ID
     * Can be overridden via WORMHOLE_RELAYER_ADDRESS environment variable
     */
    function _getWormholeRelayerAddress() internal view returns (address) {
        if (block.chainid == 31337) {
            // Local Anvil
            return vm.envOr("WORMHOLE_RELAYER_ADDRESS", address(0xC89Ce4735882C9F0f0FE26686c53074E09B0D550));
        } else if (block.chainid == 421614) {
            // Arbitrum Sepolia
            return vm.envOr("WORMHOLE_RELAYER_ADDRESS", address(0x7B1bD7a6b4E61c2a123AC6BC2cbfC614437D0470));
        } else if (block.chainid == 42161) {
            // Arbitrum Mainnet
            return vm.envOr("WORMHOLE_RELAYER_ADDRESS", address(0x27428DD2d3DD32A4D7f7C497eAaa23130d894911));
        } else {
            revert(string.concat("Unsupported chain ID for WormholeRelayer: ", vm.toString(block.chainid)));
        }
    }
}