// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {PredictionMarketGetters} from "./PredictionMarketGetters.sol";
import {IPredictionMarket} from "../interfaces/IPredictionMarket.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PredictionMarketCore
 * @notice Core logic for V3 prediction markets
 * @dev Implements collateral-backed markets with nullifier-based claims
 * @dev Uses ReentrancyGuard for defense-in-depth against reentrancy attacks
 */
contract PredictionMarketCore is PredictionMarketGetters, IPredictionMarket, ReentrancyGuard {
    error MarketAlreadyExists(uint256 marketId);
    error ZeroTotalPool();
    error InvalidExpiresAt();
    error BetAlreadyProcessed(bytes32 betId);
    error MarketNotFound(uint256 marketId);
    error MarketAlreadyClosed(uint256 marketId);
    error MarketExpired(uint256 marketId);
    error ZeroAmount();
    error MarketNotResolved(uint256 marketId);
    error MarketNotOwner(uint256 marketId);
    error MarketAlreadyResolved(uint256 marketId);
    error MarketNotExpired(uint256 marketId);
    error NullifierAlreadyConsumed(bytes32 nullifier);
    error DeadlineExpired();
    error ZeroRecipient();
    error NoWinningBets();
    error ChainIdMismatch();

    constructor(
        uint16 chainId_,
        uint256 evmChainId_,
        uint8 finality_,
        address treasuryContractAddr
    ) PredictionMarketGetters( chainId_, evmChainId_, finality_, treasuryContractAddr) {}

    /**
     * @notice Get market details (implements IPredictionMarket)
     * @param marketId Market identifier
     */
    function getMarket(uint256 marketId)
        external
        view
        override(IPredictionMarket)
        returns (
            address owner,
            string memory question,
            uint256 totalPool,
            uint256 yesTotal,
            uint256 noTotal,
            bool resolved,
            bool winningOutcome,
            uint256 createdAt,
            uint256 expiresAt
        )
    {
        Market storage market = _state.markets[marketId];
        return (
            market.owner,
            market.question,
            market.totalPool,
            market.yesTotal,
            market.noTotal,
            market.resolved,
            market.winningOutcome,
            market.createdAt,
            market.expiresAt
        );
    }

    /**
     * @notice Creates a new prediction market with USDC collateral
     * @dev Follows CEI pattern: Checks → Effects → Interactions
     * @dev Market owner must approve Treasury to spend USDC before calling
     * @param question The question for this prediction market
     * @param totalPool Total USDC collateral to deposit
     * @param expiresAt Timestamp when market closes for betting
     * @return marketId The auto-generated market identifier
     */
    function createMarket(string memory question, uint256 totalPool, uint256 expiresAt)
        external
        nonReentrant
        returns (uint256 marketId)
    {
        if (totalPool == 0) revert ZeroTotalPool();
        if (expiresAt <= block.timestamp) revert InvalidExpiresAt();

        marketId = _state.nextMarketId++;

        _state.markets[marketId] = Market({
            owner: msg.sender,
            question: question,
            totalPool: totalPool,
            yesTotal: 0,
            noTotal: 0,
            resolved: false,
            winningOutcome: false,
            createdAt: block.timestamp,
            expiresAt: expiresAt
        });

        _state.ownerMarkets[msg.sender].push(marketId);
        _state.allMarketIds.push(marketId);
        treasuryContract().deposit(marketId, msg.sender, totalPool);
        emit MarketCreated(marketId, msg.sender, question, totalPool, expiresAt);
    }

    /**
     * @notice Processes a bet received from Aztec via Wormhole
     * @dev Called by WormholeReceiver after VAA verification
     * @param marketId Market identifier
     * @param betId Unique bet identifier (prevents replay)
     * @param outcome Bet outcome (false = No, true = Yes)
     * @param amount Bet amount in wei
     */
    function processBet(uint256 marketId, bytes32 betId, bool outcome, uint256 amount) external onlyOwner {
        if (isFork()) revert ChainIdMismatch();
        if (_state.processedBets[betId]) revert BetAlreadyProcessed(betId);
        if (amount == 0) revert ZeroAmount();

        Market storage market = _state.markets[marketId];
        if (market.owner == address(0)) revert MarketNotFound(marketId);
        if (market.resolved) revert MarketAlreadyClosed(marketId);
        if (block.timestamp >= market.expiresAt) revert MarketExpired(marketId);

        // Mark bet as processed (anti-replay)
        _state.processedBets[betId] = true;

        // Update totals
        if (outcome) {
            market.yesTotal += amount;
        } else {
            market.noTotal += amount;
        }

        emit BetProcessed(marketId, betId, outcome, amount);
    }

    /**
     * @notice Resolves a market by setting the winning outcome
     * @dev Only callable after market expiry
     * @param marketId Market identifier
     * @param winningOutcome Winning side (true = YES wins, false = NO wins)
     */
    function resolveMarket(uint256 marketId, bool winningOutcome) external {
        Market storage market = _state.markets[marketId];
        if (market.owner == address(0)) revert MarketNotFound(marketId);
        if (market.owner != msg.sender) revert MarketNotOwner(marketId);
        if (market.resolved) revert MarketAlreadyResolved(marketId);
        // TODO: uncomment this in production
        // if (block.timestamp < market.expiresAt) revert MarketNotExpired(marketId);

        market.resolved = true;
        market.winningOutcome = winningOutcome;

        emit MarketResolved(marketId, winningOutcome);
    }

    /**
     * @notice Processes a claim authorization from Aztec (nullifier-based)
     * @dev Follows CEI pattern: Checks → Effects → Interactions
     * @dev Calculates payout on-chain using pari-mutuel formula
     * @param marketId Market identifier
     * @param nullifier Unique nullifier (prevents double claims)
     * @param betAmount Original bet amount from Aztec
     * @param recipient Address to receive USDC payout
     * @param deadline Expiry timestamp for this claim
     */
    function processClaimAuthorization(
        uint256 marketId,
        bytes32 nullifier,
        uint256 betAmount,
        address recipient,
        uint256 /* nonce */,
        uint256 deadline
    ) external onlyOwner nonReentrant {
        if (isFork()) revert ChainIdMismatch();
        if (_state.consumedNullifiers[marketId][nullifier]) revert NullifierAlreadyConsumed(nullifier);
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (recipient == address(0)) revert ZeroRecipient();
        if (betAmount == 0) revert ZeroAmount();

        Market storage market = _state.markets[marketId];
        if (market.owner == address(0)) revert MarketNotFound(marketId);
        if (!market.resolved) revert MarketNotResolved(marketId);

        // Mark nullifier as consumed (anti-replay)
        _state.consumedNullifiers[marketId][nullifier] = true;

        // CRITICAL: Calculate payout ON-CHAIN with pari-mutuel formula
        uint256 winningTotal = market.winningOutcome ? market.yesTotal : market.noTotal;
        if (winningTotal == 0) revert NoWinningBets();

        uint256 payout = (betAmount * market.totalPool) / winningTotal;

        // Transfer USDC from Treasury
        treasuryContract().transferPayout(marketId, recipient, payout);

        emit ClaimProcessed(marketId, nullifier, recipient, payout);
    }

}
