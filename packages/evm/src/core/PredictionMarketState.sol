// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PredictionMarketState
 * @notice V3 state management for prediction markets
 * @dev Uses nullifier-based claims and USDC collateral
 */
contract PredictionMarketState is Ownable {
    error ZeroWormholeAddress();
    error ZeroTreasuryAddress();
    error InvalidFinality();

    struct Provider {
        uint16 chainId;
        uint8 finality;
    }

    struct Market {
        address owner;
        uint256 totalPool;
        uint256 yesTotal;
        uint256 noTotal;
        bool resolved;
        bool winningOutcome;
        uint256 createdAt;
        uint256 expiresAt;
    }

    struct State {
        address wormholeAddr;
        Provider provider;
        uint256 evmChainId;
        address treasuryContractAddr;

        // Market data
        mapping(uint256 => Market) markets;

        // Market indexing (for queries)
        mapping(address => uint256[]) ownerMarkets;  // owner → marketIds
        uint256[] allMarketIds;  // All created market IDs

        // Anti-replay for bets
        mapping(bytes32 => bool) processedBets;

        // Anti-replay for claims (nullifier-based)
        mapping(uint256 => mapping(bytes32 => bool)) consumedNullifiers;
    }

    State internal _state;

    /**
     * @notice Initialize prediction market state
     * @param wormholeAddr_ Wormhole contract address
     * @param chainId_ Wormhole Chain ID (10003 = Arbitrum Sepolia)
     * @param evmChainId_ Native EVM Chain ID (421614 = Arbitrum Sepolia)
     * @param finality_ Number of confirmations for finality
     * @param treasuryContractAddr_ Treasury contract address
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
        _state.provider.finality = finality_;
        _state.evmChainId = evmChainId_;
        _state.treasuryContractAddr = treasuryContractAddr_;
    }
}
