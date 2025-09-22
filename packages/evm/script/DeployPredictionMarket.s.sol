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
 *   WORMHOLE_ADDRESS - Override Wormhole contract address
 *   AZTEC_EMITTER_ADDRESS - Override Aztec emitter address
 *   WORMHOLE_CHAIN_ID - Override Wormhole chain ID
 *   FINALITY - Override finality blocks
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
        console.log("Wormhole Chain ID:", wormholeChainId);
        console.log("Finality:", finality);
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
        WormholeReceiver wormholeReceiver = new WormholeReceiver(
            payable(wormholeAddress),
            wormholeChainId,
            block.chainid,
            finality,
            address(treasury),
            address(predictionMarketCore)
        );
        console.log("WormholeReceiver deployed to:", address(wormholeReceiver));

        // 4. Set up permissions
        // Transfer Treasury ownership to PredictionMarketCore so it can mint/transfer
        treasury.transferOwnership(address(predictionMarketCore));
        console.log("Treasury ownership transferred to PredictionMarketCore");

        // Register Aztec emitter in WormholeReceiver
        wormholeReceiver.registerEmitter(56, aztecEmitter); // 56 = Aztec Wormhole Chain ID
        console.log("Registered Aztec emitter:", vm.toString(aztecEmitter));

        vm.stopBroadcast();

        console.log("=== Deployment Summary ===");
        console.log("Treasury Contract:", address(treasury));
        console.log("PredictionMarketCore Contract:", address(predictionMarketCore));
        console.log("WormholeReceiver Contract:", address(wormholeReceiver));
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
            // Arbitrum Sepolia - can override via env vars
            wormholeAddress = vm.envOr("WORMHOLE_ADDRESS", address(0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35));
            wormholeChainId = uint16(vm.envOr("WORMHOLE_CHAIN_ID", uint256(10003)));
            finality = uint8(vm.envOr("FINALITY", uint256(2)));
            aztecEmitter = vm.envOr("AZTEC_EMITTER_ADDRESS", bytes32(0x0f8a2300a7925c586135b1c142dc0b833f20d5c41ea6e815900d65d041e96cf5));
        } else {
            revert(string.concat("Unsupported chain ID: ", vm.toString(block.chainid), " (only local and testnet supported)"));
        }
    }
}