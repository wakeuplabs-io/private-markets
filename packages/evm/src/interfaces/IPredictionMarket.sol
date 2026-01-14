// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPredictionMarket
 * @notice Interface for PredictionMarketCore contract
 * @dev Supports hybrid architecture (Aztec + Arbitrum) with nullifier-based claims
 */
interface IPredictionMarket {
    event MarketCreated(uint256 indexed marketId, address indexed owner, string question, uint256 totalPool, uint256 expiresAt);
    event BetProcessed(uint256 indexed marketId, bytes32 indexed betId, bool outcome, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool winningOutcome);
    event ClaimProcessed(uint256 indexed marketId, bytes32 indexed nullifier, address recipient, uint256 payout);

    function createMarket(string memory question, uint256 totalPool, uint256 expiresAt) external returns (uint256 marketId);
    function processBet(uint256 marketId, bytes32 betId, bool outcome, uint256 amount) external;
    function resolveMarket(uint256 marketId, bool winningOutcome) external;
    function processClaimAuthorization(
        uint256 marketId,
        bytes32 nullifier,
        uint256 betAmount,
        address recipient
    ) external;
    function getMarket(uint256 marketId) external view returns (
        address owner,
        string memory question,
        uint256 totalPool,
        uint256 yesTotal,
        uint256 noTotal,
        bool resolved,
        bool winningOutcome,
        uint256 createdAt,
        uint256 expiresAt
    );
}