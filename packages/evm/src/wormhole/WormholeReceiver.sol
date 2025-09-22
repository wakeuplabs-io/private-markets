// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {IWormhole} from "wormhole-foundation/ethereum/contracts/interfaces/IWormhole.sol";
import {IWormholeRelayer} from "wormhole-foundation/relayer/ethereum/contracts/interfaces/relayer/IWormholeRelayer.sol";
import {IWormholeReceiver} from "wormhole-foundation/relayer/ethereum/contracts/interfaces/relayer/IWormholeReceiver.sol";
import {PredictionMarketGetters} from "../core/PredictionMarketGetters.sol";
import {IPredictionMarket} from "../interfaces/IPredictionMarket.sol";

/**
 * @title WormholeReceiver
 * @dev Receives and processes VAAs from Aztec for prediction market bets
 * This contract runs on Arbitrum Sepolia and receives cross-chain messages from Aztec
 */
contract WormholeReceiver is PredictionMarketGetters, IWormholeReceiver {

    // Custom Errors
    error ZeroPredictionMarketAddress();
    error ChainIdMismatch();
    error PayloadTooShort(uint256 provided, uint256 required);
    error InvalidMarketId();
    error InvalidBetId();
    error ZeroAmount();
    error InvalidCommitment();
    error ZeroEmitterAddress();
    error MessageAlreadyProcessed(bytes32 deliveryHash);

    /**
     * @dev Event emitted when an emitter is registered
     * @param chainId The chain ID of the emitter
     * @param emitterAddress The emitter address as bytes32
     */
    event EmitterRegistered(uint16 indexed chainId, bytes32 emitterAddress);

    /**
     * @dev Event emitted when a VAA bet message is processed and forwarded
     * @param marketId The market ID from the bet
     * @param betId The transaction ID of the processed bet
     * @param outcome The outcome being bet on (false = No, true = Yes)
     * @param amount The bet amount
     * @param commitment The user's commitment hash
     */
    event BetReceived(uint256 indexed marketId, bytes32 indexed betId, bool outcome, uint256 amount, bytes32 commitment);

    // Reference to the prediction market core contract
    IPredictionMarket public immutable PREDICTION_MARKET;

    // Reference to the Wormhole Relayer contract
    IWormholeRelayer public immutable wormholeRelayer;

    // Address that can register senders (owner)
    address public registrationOwner;

    // Mapping to store registered senders for each chain
    mapping(uint16 => bytes32) public registeredSenders;

    // Track processed messages to prevent replay attacks
    mapping(bytes32 => bool) public processedMessages;

    /**
     * @dev Constructor initializes parent PredictionMarketGetters and sets core contract
     * @param wormholeAddr Address of the Wormhole contract
     * @param wormholeRelayerAddr Address of the Wormhole Relayer contract
     * @param chainId_ Wormhole Chain ID for this receiver (10003 = Arbitrum Sepolia)
     * @param evmChainId_ Native EVM Chain ID (421614 = Arbitrum Sepolia)
     * @param finality_ Number of confirmations required for finality
     * @param treasuryContractAddr Address of the treasury contract
     * @param predictionMarketAddr Address of the PredictionMarketCore contract
     */
    constructor(
        address payable wormholeAddr,
        address wormholeRelayerAddr,
        uint16 chainId_,
        uint256 evmChainId_,
        uint8 finality_,
        address treasuryContractAddr,
        address predictionMarketAddr
    ) PredictionMarketGetters(wormholeAddr, chainId_, evmChainId_, finality_, treasuryContractAddr) {
        if (predictionMarketAddr == address(0)) revert ZeroPredictionMarketAddress();
        if (wormholeRelayerAddr == address(0)) revert ZeroPredictionMarketAddress(); // Reuse error for now

        PREDICTION_MARKET = IPredictionMarket(predictionMarketAddr);
        wormholeRelayer = IWormholeRelayer(wormholeRelayerAddr);
        registrationOwner = msg.sender;
    }

    /**
     * @dev Modifier to ensure only the Wormhole Relayer can call certain functions
     */
    modifier onlyRelayer() {
        require(msg.sender == address(wormholeRelayer), "Only the Wormhole relayer can call this function");
        _;
    }

    /**
     * @dev Modifier to check if the sender is registered for the source chain
     * @param sourceChain The Wormhole chain ID of the source
     * @param sourceAddress The address of the sender as bytes32
     */
    modifier isRegisteredSender(uint16 sourceChain, bytes32 sourceAddress) {
        require(registeredSenders[sourceChain] == sourceAddress, "Not registered sender");
        _;
    }


    /**
     * @notice Standard Wormhole message receiver function
     * @dev This is the recommended pattern from Wormhole documentation
     * @param payload The message payload
     * @param additionalMessages Additional messages (not used in this implementation)
     * @param sourceAddress The address of the sender (as bytes32)
     * @param sourceChain The chain ID of the sender
     * @param deliveryHash The hash of the delivery
     */
    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory additionalMessages, // additionalMessages - not used in this implementation
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32 deliveryHash
    ) public payable override onlyRelayer isRegisteredSender(sourceChain, sourceAddress) {
        // Prevent replay attacks
        if (processedMessages[deliveryHash]) {
            revert MessageAlreadyProcessed(deliveryHash);
        }

        // Mark message as processed
        processedMessages[deliveryHash] = true;

        // Process the bet payload
        _processBetPayload(payload);
    }


    /**
     * @dev Processes bet payload from Aztec
     * Supports both abi.encode (standard Wormhole) and abi.encodePacked formats
     */
    function _processBetPayload(bytes memory payload) internal {
        // Verify we're not running on a fork
        if (isFork()) revert ChainIdMismatch();

        uint256 marketId;
        bytes32 betId;
        bool outcome;
        uint256 amount;
        bytes32 commitment;

        // Try to decode as abi.encode first (standard Wormhole format)
        if (_tryDecodeAbiEncode(payload)) {
            (marketId, betId, outcome, amount, commitment) = abi.decode(payload, (uint256, bytes32, bool, uint256, bytes32));
        } else {
            // Fallback to abi.encodePacked format (legacy)
            if (payload.length < 129) revert PayloadTooShort(payload.length, 129);

            assembly {
                // Extract marketId (first 32 bytes)
                marketId := mload(add(payload, 32))
                // Extract betId (next 32 bytes)
                betId := mload(add(payload, 64))
                // Extract outcome (next 1 byte: 0x00 = false/No, 0x01 = true/Yes)
                let outcomeRaw := byte(0, mload(add(payload, 96)))
                outcome := gt(outcomeRaw, 0)
                // Extract amount (next 32 bytes)
                amount := mload(add(payload, 97))
                // Extract commitment (next 32 bytes)
                commitment := mload(add(payload, 129))
            }
        }

        // Validate extracted data
        if (marketId == 0) revert InvalidMarketId();
        if (betId == bytes32(0)) revert InvalidBetId();
        if (amount == 0) revert ZeroAmount();
        if (commitment == bytes32(0)) revert InvalidCommitment();

        // Forward bet to PredictionMarketCore
        PREDICTION_MARKET.processBet(marketId, betId, outcome, amount, commitment);

        emit BetReceived(marketId, betId, outcome, amount, commitment);
    }

    /**
     * @dev Try to detect if payload is abi.encode format
     * abi.encode has specific length patterns and alignment
     */
    function _tryDecodeAbiEncode(bytes memory payload) internal view returns (bool) {
        // abi.encode for (uint256, bytes32, bool, uint256, bytes32) should be exactly 160 bytes
        // 32 + 32 + 32 + 32 + 32 = 160 (bool is padded to 32 bytes)
        if (payload.length != 160) return false;

        // Additional validation: try to decode and see if it works
        try this._testDecodeAbiEncode(payload) returns (bool) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev External function for testing abi.decode (can't use try/catch with internal functions)
     */
    function _testDecodeAbiEncode(bytes memory payload) external pure returns (bool) {
        abi.decode(payload, (uint256, bytes32, bool, uint256, bytes32));
        return true;
    }


    /**
     * @notice Registers a sender from another chain for verification
     * @dev Only the registration owner can register senders
     * @param sourceChain The Wormhole chain ID of the sender (e.g., 56 for Aztec)
     * @param sourceAddress The sender contract address as bytes32
     */
    function setRegisteredSender(uint16 sourceChain, bytes32 sourceAddress) external {
        require(msg.sender == registrationOwner, "Not allowed to set registered sender");
        if (sourceAddress == bytes32(0)) revert ZeroEmitterAddress();

        registeredSenders[sourceChain] = sourceAddress;

        emit EmitterRegistered(sourceChain, sourceAddress);
    }
}