// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {IWormhole} from "wormhole-foundation/ethereum/contracts/interfaces/IWormhole.sol";
import {PredictionMarketState} from "./PredictionMarketState.sol";
import {ITreasury} from "../interfaces/ITreasury.sol";

/**
 * @title PredictionMarketGetters
 * @notice Accessor functions for V3 prediction market state
 * @dev Provides read-only views into markets, bets, and nullifiers
 */
contract PredictionMarketGetters is PredictionMarketState {
    constructor(
        uint16 chainId_,
        uint256 evmChainId_,
        uint8 finality_,
        address treasuryContractAddr_
    ) PredictionMarketState(chainId_, evmChainId_, finality_, treasuryContractAddr_) {}

    function wormhole() public view returns (IWormhole) {
        return IWormhole(_state.wormholeAddr);
    }

    function chainId() public view returns (uint16) {
        return _state.provider.chainId;
    }

    function evmChainId() public view returns (uint256) {
        return _state.evmChainId;
    }

    function isFork() public view returns (bool) {
        return evmChainId() != block.chainid;
    }

    function finality() public view returns (uint8) {
        return _state.provider.finality;
    }

    function treasuryContract() public view returns (ITreasury) {
        return ITreasury(_state.treasuryContractAddr);
    }

    function isProcessed(bytes32 betId) public view returns (bool) {
        return _state.processedBets[betId];
    }

    function isNullifierConsumed(uint256 marketId, bytes32 nullifier) public view returns (bool) {
        return _state.consumedNullifiers[marketId][nullifier];
    }

    function getMarketTotals(uint256 marketId) public view returns (uint256 yesTotal, uint256 noTotal) {
        Market storage market = _state.markets[marketId];
        return (market.yesTotal, market.noTotal);
    }

    /**
     * @notice Get total number of markets created by an owner
     * @param owner Address of the market creator
     * @return Total number of markets owned
     */
    function getOwnerMarketCount(address owner) public view returns (uint256) {
        return _state.ownerMarkets[owner].length;
    }

    /**
     * @notice Get total number of markets created
     * @return Total number of markets
     */
    function getAllMarketsCount() public view returns (uint256) {
        return _state.allMarketIds.length;
    }

    /**
     * @notice Get paginated markets created by a specific owner
     * @dev Returns empty arrays if offset >= total
     * @param owner Address of the market creator
     * @param offset Starting index (0-based)
     * @param limit Maximum number of markets to return (max 100)
     * @return marketIds Array of market IDs
     * @return marketResults Array of Market structs
     * @return total Total markets owned by this address
     */
    function getMarketsByOwner(address owner, uint256 offset, uint256 limit)
        public
        view
        returns (
            uint256[] memory marketIds,
            Market[] memory marketResults,
            uint256 total
        )
    {
        require(limit <= 100, "Limit too high");

        uint256[] storage ownerMarketIds = _state.ownerMarkets[owner];
        total = ownerMarketIds.length;

        // Return empty arrays if offset is out of bounds
        if (offset >= total) {
            return (new uint256[](0), new Market[](0), total);
        }

        // Calculate actual number of items to return
        uint256 remaining = total - offset;
        uint256 count = remaining < limit ? remaining : limit;

        // Allocate memory arrays
        marketIds = new uint256[](count);
        marketResults = new Market[](count);

        // Populate arrays
        for (uint256 i = 0; i < count; i++) {
            uint256 marketId = ownerMarketIds[offset + i];
            marketIds[i] = marketId;
            marketResults[i] = _state.markets[marketId];
        }
    }

    /**
     * @notice Get paginated active markets (not resolved and not expired)
     * @dev Iterates through all markets to filter active ones
     * @dev Less efficient than getMarketsByOwner but acceptable for view functions
     * @param offset Starting index (0-based, relative to filtered results)
     * @param limit Maximum number of markets to return (max 100)
     * @return marketIds Array of market IDs
     * @return marketResults Array of Market structs
     * @return total Total active markets
     */
    function getActiveMarkets(uint256 offset, uint256 limit)
        public
        view
        returns (
            uint256[] memory marketIds,
            Market[] memory marketResults,
            uint256 total
        )
    {
        require(limit <= 100, "Limit too high");

        uint256[] storage allIds = _state.allMarketIds;
        uint256 allCount = allIds.length;

        // First pass: count active markets
        uint256 activeCount = 0;
        for (uint256 i = 0; i < allCount; i++) {
            Market storage market = _state.markets[allIds[i]];
            if (!market.resolved && block.timestamp < market.expiresAt) {
                activeCount++;
            }
        }

        total = activeCount;

        // Return empty arrays if offset is out of bounds
        if (offset >= total || total == 0) {
            return (new uint256[](0), new Market[](0), total);
        }

        // Calculate actual number of items to return
        uint256 remaining = total - offset;
        uint256 count = remaining < limit ? remaining : limit;

        // Allocate memory arrays
        marketIds = new uint256[](count);
        marketResults = new Market[](count);

        // Second pass: populate arrays
        uint256 activeIndex = 0;
        uint256 resultIndex = 0;

        for (uint256 i = 0; i < allCount && resultIndex < count; i++) {
            uint256 marketId = allIds[i];
            Market storage market = _state.markets[marketId];

            if (!market.resolved && block.timestamp < market.expiresAt) {
                if (activeIndex >= offset) {
                    marketIds[resultIndex] = marketId;
                    marketResults[resultIndex] = market;
                    resultIndex++;
                }
                activeIndex++;
            }
        }
    }
}
