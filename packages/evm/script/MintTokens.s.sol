// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {console} from "forge-std/console.sol";

/**
 * @title MintTokens
 * @notice Script to mint tokens to a recipient
 * 
 * Usage:
 *   npm run evm:mint:testnet
 */
contract MintTokens is Script {

    address constant TOKEN = 0xdEd316ebaA76E86478ebFAd4F2e42122d97907Eb;  // MockERC20 (USDC) en Arbitrum Sepolia
    address constant RECIPIENT = 0x3e24adA7AcD59223147b2bbc7BE2fB4cA03303F9; 
    uint256 constant AMOUNT = 10000000000000;  // 10,000 USDC 

    function run() external {
        MockERC20 usdc = MockERC20(TOKEN);

        console.log("Minting tokens to:", RECIPIENT);
        console.log("Amount:", AMOUNT);

        vm.broadcast();
        usdc.mint(RECIPIENT, AMOUNT * 10**6);

        console.log("Done!");
    }
}

