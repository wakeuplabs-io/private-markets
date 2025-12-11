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

    address constant TOKEN = 0x4aaB05112eCDba70b99Ab05002ec9f492E7bba8e;
    address constant RECIPIENT = 0xD245710638f66A16386df955D45e65d13B0C0E3e; 
    uint256 constant AMOUNT = 1000000000000000000000000;  // 1,000,000 USDC 

    function run() external {
        MockERC20 usdc = MockERC20(TOKEN);

        console.log("Minting tokens to:", RECIPIENT);
        console.log("Amount:", AMOUNT);

        vm.broadcast();
        usdc.mint(RECIPIENT, AMOUNT * 10**6);

        console.log("Done!");
    }
}

