// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {IWormhole} from "wormhole-foundation/ethereum/contracts/interfaces/IWormhole.sol";
import {PredictionMarketState} from "./PredictionMarketState.sol";
import {ITreasury} from "../interfaces/ITreasury.sol";
import {IPredictionMarket} from "../interfaces/IPredictionMarket.sol";

/**
 * @title PredictionMarketGetters
 * @dev Provides accessor functions for prediction market state values
 */
contract PredictionMarketGetters is PredictionMarketState {
    /**
     * @dev Constructor initializes parent PredictionMarketState
     * @param wormholeAddr_ Address of the Wormhole contract on this chain
     * @param chainId_ Wormhole Chain ID for this vault (10003 = Arbitrum Sepolia)
     * @param evmChainId_ Native EVM Chain ID (421614 = Arbitrum Sepolia)
     * @param finality_ Number of confirmations required for finality
     * @param treasuryContractAddr_ Address of the treasury contract
     */
    constructor(
        address payable wormholeAddr_,
        uint16 chainId_,
        uint256 evmChainId_,
        uint8 finality_,
        address treasuryContractAddr_
    ) PredictionMarketState(wormholeAddr_, chainId_, evmChainId_, finality_, treasuryContractAddr_) {}

    /**
     * @dev Returns the Wormhole contract instance
     * @return IWormhole interface to the Wormhole contract
     */
    function wormhole() public view returns (IWormhole) {
        return IWormhole(_state.wormholeAddr);
    }

    /**
     * @dev Returns the Wormhole chain ID for this vault
     * @return uint16 Wormhole Chain ID (10003 for Arbitrum Sepolia)
     */
    function chainId() public view returns (uint16) {
        return _state.provider.chainId;
    }

    /**
     * @dev Returns the native EVM chain ID
     * @return uint256 Native EVM Chain ID (421614 for Arbitrum Sepolia)
     */
    function evmChainId() public view returns (uint256) {
        return _state.evmChainId;
    }

    /**
     * @dev Checks if the contract is running on a different EVM chain than intended
     * @return bool True if running on a different chain than intended (fork detected)
     */
    function isFork() public view returns (bool) {
        return evmChainId() != block.chainid;
    }

    /**
     * @dev Gets the registered emitter address for a given Wormhole chain
     * @param chainId_ The Wormhole chain ID to query (e.g., 56 for Aztec)
     * @return bytes32 The registered emitter contract address
     */
    function getRegisteredEmitter(uint16 chainId_) public view returns (bytes32) {
        return _state.registeredEmitters[chainId_];
    }

    /**
     * @dev Returns the finality requirement
     * @return uint8 Number of confirmations required for finality
     */
    function finality() public view returns (uint8) {
        return _state.provider.finality;
    }

    /**
     * @dev Returns the treasury contract interface
     * @return ITreasury interface to the treasury contract
     */
    function treasuryContract() public view returns (ITreasury) {
        return ITreasury(_state.treasuryContractAddr);
    }

    /**
     * @dev Gets market data by ID
     * @param marketId The market ID to query
     * @return Market struct containing market information
     */
    function getMarket(uint256 marketId) public view virtual returns (IPredictionMarket.Market memory) {
        return _state.markets[marketId];
    }

    /**
     * @dev Gets betting totals for Yes outcome
     * @param marketId The market ID
     * @return uint256 Total amount bet on Yes
     */
    function getYesTotals(uint256 marketId) public view virtual returns (uint256) {
        return _state.totals[marketId].yesTotal;
    }

    /**
     * @dev Gets betting totals for No outcome
     * @param marketId The market ID
     * @return uint256 Total amount bet on No
     */
    function getNoTotals(uint256 marketId) public view virtual returns (uint256) {
        return _state.totals[marketId].noTotal;
    }

    /**
     * @dev Gets betting totals for both outcomes
     * @param marketId The market ID
     * @return noTotal Total amount bet on No
     * @return yesTotal Total amount bet on Yes
     */
    function getAllTotals(uint256 marketId) public view virtual returns (uint256 noTotal, uint256 yesTotal) {
        PredictionMarketState.MarketTotals storage totals = _state.totals[marketId];
        return (totals.noTotal, totals.yesTotal);
    }

    /**
     * @dev Checks if a bet has been processed
     * @param betId The bet ID to check
     * @return bool True if bet has been processed
     */
    function isProcessed(bytes32 betId) public view returns (bool) {
        return _state.processed[betId];
    }

    /**
     * @dev Gets the winners root for a market
     * @param marketId The market ID
     * @return bytes32 The Merkle tree root for winners
     */
    function getWinnersRoot(uint256 marketId) public view returns (bytes32) {
        return _state.winnersRoot[marketId];
    }

    /**
     * @dev Checks if a payout has been claimed
     * @param marketId The market ID
     * @param commitment The user's commitment
     * @return bool True if payout has been claimed
     */
    function isClaimed(uint256 marketId, bytes32 commitment) public view returns (bool) {
        return _state.claimed[marketId][commitment];
    }

    /**
     * @dev Gets the total number of markets created
     * @return uint256 Total market count
     */
    function getMarketCount() public view returns (uint256) {
        return _state.marketCounter;
    }

    /**
     * @dev Gets market ID at a specific index
     * @param index The index to query
     * @return uint256 Market ID at that index
     */
    function getMarketIdAt(uint256 index) public view returns (uint256) {
        require(index < _state.marketIds.length, "Index out of bounds");
        return _state.marketIds[index];
    }

    /**
     * @dev Gets multiple markets with pagination
     * @param offset Starting index
     * @param limit Number of markets to return
     * @return markets Array of Market structs
     */
    function getAllMarkets(uint256 offset, uint256 limit) public view returns (IPredictionMarket.Market[] memory markets) {
        uint256 total = _state.marketIds.length;
        if (offset >= total) {
            return new IPredictionMarket.Market[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 length = end - offset;
        markets = new IPredictionMarket.Market[](length);

        for (uint256 i = 0; i < length; i++) {
            uint256 marketId = _state.marketIds[offset + i];
            markets[i] = _state.markets[marketId];
        }
    }

    /**
     * @dev Gets all markets with a specific state
     * @param state The market state to filter by
     * @return markets Array of markets with the specified state
     */
    function getMarketsByState(IPredictionMarket.MarketState state) public view returns (IPredictionMarket.Market[] memory markets) {
        uint256[] memory filteredIds = new uint256[](_state.marketIds.length);
        uint256 count = 0;

        for (uint256 i = 0; i < _state.marketIds.length; i++) {
            uint256 marketId = _state.marketIds[i];
            if (_state.markets[marketId].state == state) {
                filteredIds[count] = marketId;
                count++;
            }
        }

        markets = new IPredictionMarket.Market[](count);
        for (uint256 i = 0; i < count; i++) {
            markets[i] = _state.markets[filteredIds[i]];
        }
    }
}