// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {IPredictionMarket} from "../interfaces/IPredictionMarket.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PredictionMarketState
 * @dev Manages the core state for the PredictionMarket system and handles ownership
 */
contract PredictionMarketState is Ownable {
    // Custom Errors
    error ZeroWormholeAddress();
    error ZeroTreasuryAddress();
    error InvalidFinality();
    error UnauthorizedCaller(address caller, address owner);

    struct Provider {
        uint16 chainId;
        uint16 governanceChainId;
        uint8 finality;
        bytes32 governanceContract;
    }

    struct MarketTotals {
        uint256 noTotal;   // false/No bets
        uint256 yesTotal;  // true/Yes bets
    }

    struct State {
        address wormholeAddr;
        Provider provider;

        // Registered emitter addresses for cross-chain verification
        mapping(uint16 => bytes32) registeredEmitters;

        // EIP-155 Chain ID
        uint256 evmChainId;

        // Market counter for auto-incremental IDs
        uint256 marketCounter;

        // Array of all market IDs for iteration
        uint256[] marketIds;

        // Market data
        mapping(uint256 => IPredictionMarket.Market) markets;

        // Market betting totals for binary outcomes
        mapping(uint256 => MarketTotals) totals;

        // Processed bet IDs to prevent replay attacks
        mapping(bytes32 => bool) processed;

        // Winners root for each market (Merkle tree root)
        mapping(uint256 => bytes32) winnersRoot;

        // Claimed payouts to prevent double claims
        mapping(uint256 => mapping(bytes32 => bool)) claimed; // marketId => commitment => claimed

        // Treasury contract address
        address treasuryContractAddr;
    }

    State internal _state;

    /**
     * @dev Constructor to initialize the prediction market state
     * @param wormholeAddr_ Address of the Wormhole contract on this chain (Arbitrum Sepolia)
     * @param chainId_ Wormhole Chain ID for this vault (10003 = Arbitrum Sepolia)
     * @param evmChainId_ Native EVM Chain ID (421614 = Arbitrum Sepolia)
     * @param finality_ Number of confirmations required for finality
     * @param treasuryContractAddr_ Address of the treasury contract
     */
    constructor(
        address wormholeAddr_,
        uint16 chainId_,
        uint256 evmChainId_,
        uint8 finality_,
        address treasuryContractAddr_
    ) Ownable(msg.sender) {
        if (wormholeAddr_ == address(0)) revert ZeroWormholeAddress();
        if (treasuryContractAddr_ == address(0)) revert ZeroTreasuryAddress();
        if (finality_ == 0) revert InvalidFinality();

        _state.wormholeAddr = wormholeAddr_;
        _state.provider.chainId = chainId_;
        _state.evmChainId = evmChainId_;
        _state.provider.finality = finality_;

        _state.provider.governanceChainId = 0;
        _state.provider.governanceContract = bytes32(0);

        _state.treasuryContractAddr = treasuryContractAddr_;
    }
}