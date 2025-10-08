// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

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
    error UnknownMessageType(uint8 messageType);
    error EmptyPayload();
    error InvalidNullifier();
    error ZeroRecipient();

    /**
     * @dev Event emitted when an emitter is registered
     * @param chainId The chain ID of the emitter
     * @param emitterAddress The emitter address as bytes32
     */
    event EmitterRegistered(uint16 indexed chainId, bytes32 emitterAddress);

    /**
     * @dev Event emitted when any Wormhole message is received (for debugging/auditing)
     * @param sourceChain The Wormhole chain ID of the sender
     * @param sourceAddress The sender contract address as bytes32
     * @param deliveryHash Unique hash for this delivery
     * @param messageType The type of message (0x01=BET, 0x02=CLAIM_AUTH)
     * @param payloadLength Length of the payload in bytes
     */
    event MessageReceived(
        uint16 indexed sourceChain,
        bytes32 indexed sourceAddress,
        bytes32 deliveryHash,
        uint8 messageType,
        uint256 payloadLength
    );

    /**
     * @dev Event emitted when a VAA bet message is processed and forwarded
     * @param marketId The market ID from the bet
     * @param betId The transaction ID of the processed bet
     * @param outcome The outcome being bet on (false = No, true = Yes)
     * @param amount The bet amount
     */
    event BetReceived(uint256 indexed marketId, bytes32 indexed betId, bool outcome, uint256 amount);

    /**
     * @dev Event emitted when a claim authorization message is processed
     * @param marketId The market ID
     * @param nullifier Unique identifier for the claim
     * @param recipient Address to receive the payout
     * @param betAmount Original bet amount from Aztec
     */
    event ClaimAuthorizationReceived(
        uint256 indexed marketId,
        bytes32 indexed nullifier,
        address recipient,
        uint256 betAmount
    );

    // Reference to the prediction market core contract
    IPredictionMarket public immutable PREDICTION_MARKET;

    // Reference to the Wormhole Relayer contract
    IWormholeRelayer public immutable WORMHOLE_RELAYER;

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
        WORMHOLE_RELAYER = IWormholeRelayer(wormholeRelayerAddr);
        registrationOwner = msg.sender;
    }

    /**
     * @dev Modifier to ensure only the Wormhole Relayer can call certain functions
     */
    modifier onlyRelayer() {
        require(msg.sender == address(WORMHOLE_RELAYER), "Only the Wormhole relayer can call this function");
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
     * @param sourceAddress The address of the sender (as bytes32)
     * @param sourceChain The chain ID of the sender
     * @param deliveryHash The hash of the delivery
     */
    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory /* additionalMessages */,
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

        // V3: Route by message type (first byte)
        if (payload.length == 0) revert EmptyPayload();
        uint8 messageType = uint8(payload[0]);

        // Emit raw message event for debugging/auditing
        emit MessageReceived(sourceChain, sourceAddress, deliveryHash, messageType, payload.length);

        if (messageType == 0x01) {
            // BET message
            _processBetPayload(payload);
        } else if (messageType == 0x02) {
            // CLAIM_AUTHORIZATION message
            _processClaimAuthPayload(payload);
        } else {
            revert UnknownMessageType(messageType);
        }
    }


    /**
     * @dev Processes bet payload from Aztec (V3)
     * Payload structure (98 bytes): [type(1) | marketId(32) | betId(32) | outcome(1) | amount(32)]
     */
    function _processBetPayload(bytes memory payload) internal {
        // Verify we're not running on a fork
        if (isFork()) revert ChainIdMismatch();

        // V3 BET message: exactly 98 bytes
        if (payload.length != 98) revert PayloadTooShort(payload.length, 98);
        if (uint8(payload[0]) != 0x01) revert UnknownMessageType(uint8(payload[0]));

        uint256 marketId;
        bytes32 betId;
        bool outcome;
        uint256 amount;

        assembly {
            // payload structure: [type(1) | marketId(32) | betId(32) | outcome(1) | amount(32)]
            // mload reads 32 bytes starting at given position
            // payload pointer points to length, so add 32 to get to data

            marketId := mload(add(payload, 33))    // Skip 1 byte type + 32 offset
            betId := mload(add(payload, 65))       // Skip type + marketId + 32 offset
            let outcomeRaw := byte(0, mload(add(payload, 97)))  // Skip type + marketId + betId + 32 offset
            outcome := gt(outcomeRaw, 0)           // Convert to bool (0x00=false, 0x01=true)
            amount := mload(add(payload, 98))      // Skip type + marketId + betId + outcome + 32 offset
        }

        // Validate extracted data
        if (marketId == 0) revert InvalidMarketId();
        if (betId == bytes32(0)) revert InvalidBetId();
        if (amount == 0) revert ZeroAmount();

        // V3: No commitment in message
        PREDICTION_MARKET.processBet(marketId, betId, outcome, amount);

        emit BetReceived(marketId, betId, outcome, amount);
    }

    /**
     * @dev Processes claim authorization payload from Aztec (V3)
     * Payload structure (181 bytes): [type(1) | marketId(32) | nullifier(32) | betAmount(32) | recipient(20) | nonce(32) | deadline(32)]
     */
    function _processClaimAuthPayload(bytes memory payload) internal {
        // Verify we're not running on a fork
        if (isFork()) revert ChainIdMismatch();

        // V3 CLAIM_AUTHORIZATION message: exactly 181 bytes
        if (payload.length != 181) revert PayloadTooShort(payload.length, 181);
        if (uint8(payload[0]) != 0x02) revert UnknownMessageType(uint8(payload[0]));

        uint256 marketId;
        bytes32 nullifier;
        uint256 betAmount;
        address recipient;
        uint256 nonce;
        uint256 deadline;

        assembly {
            // payload structure: [type(1) | marketId(32) | nullifier(32) | betAmount(32) | recipient(20) | nonce(32) | deadline(32)]
            // Total: 181 bytes (abi.encodePacked does NOT pad the 20-byte address)
            // mload reads 32 bytes starting at given position
            // payload pointer points to length, so add 32 to get to data
            //
            // Memory layout:
            // [0-31]:   length
            // [32]:     type (0x02)
            // [33-64]:  marketId (bytes 1-32 of payload)
            // [65-96]:  nullifier (bytes 33-64)
            // [97-128]: betAmount (bytes 65-96)
            // [129-148]: recipient (bytes 97-116) - ONLY 20 bytes!
            // [149-180]: nonce (bytes 117-148)
            // [181-212]: deadline (bytes 149-180)

            marketId := mload(add(payload, 33))        // Bytes 1-32
            nullifier := mload(add(payload, 65))       // Bytes 33-64
            betAmount := mload(add(payload, 97))       // Bytes 65-96

            // For address (20 bytes at payload[97-116]):
            // mload(129) reads bytes 97-128 (32 bytes starting at offset 97)
            // We want the FIRST 20 bytes of those 32 bytes
            // Shift right by 96 bits (12 bytes) to discard the trailing 12 bytes
            let recipientBytes := mload(add(payload, 129))
            recipient := shr(96, recipientBytes)

            nonce := mload(add(payload, 149))          // Bytes 117-148
            deadline := mload(add(payload, 181))       // Bytes 149-180
        }

        // Validate extracted data
        if (marketId == 0) revert InvalidMarketId();
        if (nullifier == bytes32(0)) revert InvalidNullifier();
        if (betAmount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroRecipient();

        // Call PredictionMarketCore to process the claim authorization
        PREDICTION_MARKET.processClaimAuthorization(marketId, nullifier, betAmount, recipient, nonce, deadline);

        emit ClaimAuthorizationReceived(marketId, nullifier, recipient, betAmount);
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