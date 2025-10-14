// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PredictionMarketCore} from "../src/core/PredictionMarketCore.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/**
 * @title CreateMarket
 * @notice Script to create a prediction market
 * 
 * Usage:
 *   npm run evm:create-market:testnet
 */
contract CreateMarket is Script {

    address constant PREDICTION_MARKET = 0x41A5068584d9D4730a667A1a5577367302e7E900;
    address constant TREASURY = 0x8BB9C7431a4d3618449B725CB75D51aE37704678;
    address constant USDC = 0xBc67AB4F6DBc711D643e612Aa27d733D0402FFc1;
    
    string constant QUESTION = "Will there be swag at NoirCon 3?";
    uint256 constant TOTAL_POOL = 100;
    uint256 constant DAYS_UNTIL_EXPIRY = 30;

    function run() external {
        PredictionMarketCore market = PredictionMarketCore(PREDICTION_MARKET);
        MockERC20 usdc = MockERC20(USDC);

        uint256 poolAmount = TOTAL_POOL * 10**6;
        uint256 expiresAt = block.timestamp + (DAYS_UNTIL_EXPIRY * 1 days);
        
        console.log("Creating market with question:", QUESTION);
        console.log("Total pool:", TOTAL_POOL, "USDC");
        console.log("Expires in", DAYS_UNTIL_EXPIRY, "days");

        vm.startBroadcast();

        // Approve Treasury to spend USDC
        console.log("Approving Treasury to spend USDC...");
        usdc.approve(TREASURY, poolAmount);

        // Create market
        uint256 marketId = market.createMarket(
            QUESTION,
            poolAmount,
            expiresAt
        );

        vm.stopBroadcast();

        console.log("Market created with ID:", marketId);
    }
}

