// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPredictionMarket {
    enum MarketState {
        OPEN,
        FINALIZED,
        RESOLVED
    }

    struct Market {
        uint256 id;
        string question;
        MarketState state;
        address admin;
        uint256 createdAt;
        uint256 closingTime;
        uint256 resolvedAt;
    }

    event MarketCreated(uint256 indexed marketId, string question, address admin);
    event BetProcessed(uint256 indexed marketId, bytes32 indexed betId, bool outcome, uint256 amount, bytes32 commitment);
    event MarketResolved(uint256 indexed marketId, bytes32 winnersRoot);
    event PayoutClaimed(uint256 indexed marketId, bytes32 indexed commitment, uint256 payout, address recipient);

    function createMarket(string memory question, uint256 closingTime) external returns (uint256);
    function processBet(uint256 marketId, bytes32 betId, bool outcome, uint256 amount, bytes32 commitment) external;
    function setWinnersRoot(uint256 marketId, bytes32 root) external;
    function claim(uint256 marketId, uint256 payout, bytes32[] memory proof, bytes32 secret, address to) external;
}