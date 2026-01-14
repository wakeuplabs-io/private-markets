// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PredictionMarketCore} from "../src/core/PredictionMarketCore.sol";
import {MockERC20} from "../src/MockERC20.sol";

/**
 * @title CreateMarket
 * @notice Script to create a prediction market
 * 
 * Usage:
 *   npm run evm:create-market:testnet
 */
contract CreateMarket is Script {

    address constant PREDICTION_MARKET = 0x72c522Ad0599a2B41e1F7C47A4F72c0f768cFF6C;
    address constant TREASURY = 0x0d830d3aFcBd1155ae83275293B06841730b895A;
    address constant USDC = 0xDd73daF9b3Fd98E95b1E50ECCFB21ad44048dC3E;
    
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

