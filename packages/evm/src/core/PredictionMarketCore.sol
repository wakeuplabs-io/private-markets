// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {PredictionMarketGetters} from "./PredictionMarketGetters.sol";
import {IPredictionMarket} from "../interfaces/IPredictionMarket.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title PredictionMarketCore
 * @dev Core prediction market contract with market creation, betting, and resolution logic
 */
contract PredictionMarketCore is PredictionMarketGetters, IPredictionMarket {
    // Custom Errors
    error EmptyQuestion();
    error InvalidClosingTime();
    error MarketAlreadyExists(uint256 marketId);
    error ChainIdMismatch();
    error InvalidBetId();
    error InvalidCommitment();
    error ZeroAmount();
    error BetAlreadyProcessed(bytes32 betId);
    error MarketNotFound(uint256 marketId);
    error MarketNotOpen(uint256 marketId, IPredictionMarket.MarketState currentState);
    error UnauthorizedResolver(address caller, address expectedAdmin);
    error MarketAlreadyResolved(uint256 marketId);
    error InvalidWinnersRoot();
    error ZeroRecipientAddress();
    error MarketNotResolved(uint256 marketId);
    error WinnersRootNotSet();
    error PayoutAlreadyClaimed(uint256 marketId, bytes32 commitment);
    error InvalidMerkleProof();
    error TransferFailed();

    /**
     * @dev Constructor initializes parent PredictionMarketGetters
     * @param wormholeAddr Address of the Wormhole contract
     * @param chainId_ Wormhole Chain ID (10003 = Arbitrum Sepolia)
     * @param evmChainId_ Native EVM Chain ID (421614 = Arbitrum Sepolia)
     * @param finality_ Number of confirmations required for finality
     * @param treasuryContractAddr Address of the treasury contract
     */
    constructor(
        address payable wormholeAddr,
        uint16 chainId_,
        uint256 evmChainId_,
        uint8 finality_,
        address treasuryContractAddr
    ) PredictionMarketGetters(wormholeAddr, chainId_, evmChainId_, finality_, treasuryContractAddr) {}

    /**
     * @notice Creates a new public prediction market (binary Yes/No)
     * @param question The market question
     * @param closingTime Timestamp when the market closes for betting
     * @return uint256 The generated market ID
     */
    function createMarket(string memory question, uint256 closingTime) external override returns (uint256) {
        return _createMarket(question, closingTime, msg.sender);
    }

    /**
     * @dev Internal function to create binary markets
     */
    function _createMarket(string memory question, uint256 closingTime, address admin) internal returns (uint256) {
        if (bytes(question).length == 0) revert EmptyQuestion();
        if (closingTime <= block.timestamp) revert InvalidClosingTime();

        // Increment counter and use as market ID
        _state.marketCounter++;
        uint256 marketId = _state.marketCounter;

        // Add to markets array for iteration
        _state.marketIds.push(marketId);

        _state.markets[marketId] = IPredictionMarket.Market({
            id: marketId,
            question: question,
            state: IPredictionMarket.MarketState.OPEN,
            admin: admin,
            createdAt: block.timestamp,
            closingTime: closingTime,
            resolvedAt: 0
        });

        emit MarketCreated(marketId, question, admin);
        return marketId;
    }

    /**
     * @notice Processes a bet received from Aztec via Wormhole
     * @param marketId The market ID
     * @param betId Unique bet identifier to prevent replay
     * @param outcome The outcome being bet on (false = No, true = Yes)
     * @param amount The bet amount in wei
     * @param commitment The user's commitment hash
     */
    function processBet(uint256 marketId, bytes32 betId, bool outcome, uint256 amount, bytes32 commitment) external override {
        if (isFork()) revert ChainIdMismatch();
        if (betId == bytes32(0)) revert InvalidBetId();
        if (commitment == bytes32(0)) revert InvalidCommitment();
        if (amount == 0) revert ZeroAmount();
        if (_state.processed[betId]) revert BetAlreadyProcessed(betId);

        IPredictionMarket.Market storage market = _state.markets[marketId];
        if (market.id == 0) revert MarketNotFound(marketId);

        if (market.state != IPredictionMarket.MarketState.OPEN) revert MarketNotOpen(marketId, market.state);

        // Only allow bets if market is still within closing time
        if (block.timestamp >= market.closingTime) revert MarketNotOpen(marketId, market.state);

        // Mark bet as processed to prevent replay
        _state.processed[betId] = true;

        // Update totals based on outcome
        if (outcome) {
            _state.totals[marketId].yesTotal += amount;
        } else {
            _state.totals[marketId].noTotal += amount;
        }

        // Mint tokens to treasury
        treasuryContract().mint(address(treasuryContract()), amount);

        emit BetProcessed(marketId, betId, outcome, amount, commitment);
    }

    /**
     * @notice Sets the winners root for a resolved market
     * @param marketId The market ID
     * @param root The Merkle tree root containing winner payouts
     */
    function setWinnersRoot(uint256 marketId, bytes32 root) external override {
        IPredictionMarket.Market storage market = _state.markets[marketId];
        if (market.id == 0) revert MarketNotFound(marketId);

        // Market must be OPEN to be resolved
        if (market.state != IPredictionMarket.MarketState.OPEN) {
            revert MarketAlreadyResolved(marketId);
        }

        // Only allow resolution after closing time
        if (block.timestamp < market.closingTime) {
            revert MarketNotOpen(marketId, market.state);
        }

        // Verify admin authorization - only market admin can resolve
        if (msg.sender != market.admin) revert UnauthorizedResolver(msg.sender, market.admin);

        if (root == bytes32(0)) revert InvalidWinnersRoot();

        market.state = IPredictionMarket.MarketState.RESOLVED;
        market.resolvedAt = block.timestamp;
        _state.winnersRoot[marketId] = root;

        emit MarketResolved(marketId, root);
    }

    /**
     * @notice Claims payout using Merkle proof
     * @param marketId The market ID
     * @param payout The payout amount
     * @param proof Merkle proof for the claim
     * @param secret The user's secret used to generate commitment
     * @param to Address to receive the payout
     */
    function claim(uint256 marketId, uint256 payout, bytes32[] memory proof, bytes32 secret, address to) external override {
        if (to == address(0)) revert ZeroRecipientAddress();

        IPredictionMarket.Market storage market = _state.markets[marketId];
        if (market.id == 0) revert MarketNotFound(marketId);
        if (market.state != IPredictionMarket.MarketState.RESOLVED) revert MarketNotResolved(marketId);

        bytes32 winnersRoot = _state.winnersRoot[marketId];
        if (winnersRoot == bytes32(0)) revert WinnersRootNotSet();

        // Reconstruct commitment from secret
        bytes32 commitment = keccak256(abi.encodePacked(marketId, secret));

        if (_state.claimed[marketId][commitment]) revert PayoutAlreadyClaimed(marketId, commitment);

        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(commitment, payout));
        if (!MerkleProof.verify(proof, winnersRoot, leaf)) revert InvalidMerkleProof();

        // Mark as claimed
        _state.claimed[marketId][commitment] = true;

        // Transfer payout from treasury
        if (!treasuryContract().transfer(to, payout)) revert TransferFailed();

        emit PayoutClaimed(marketId, commitment, payout, to);
    }



}