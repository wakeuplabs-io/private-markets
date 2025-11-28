// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {IWormhole} from "wormhole-foundation/ethereum/contracts/interfaces/IWormhole.sol";
import {IPredictionMarket} from "./core/PredictionMarketCore.sol";

/**
 * @title WormholeReceiver
 * @dev Receives and manually processes VAAs from Aztec for prediction market bets
 * This contract runs on Arbitrum Sepolia and verifies cross-chain messages from Aztec
 *
 * IMPORTANT: Uses manual VAA verification pattern (not automatic Wormhole Relayer)
 * because Aztec is not an EVM chain and automatic relayer only supports EVM chains.
 *
 * This contract is independent and does not inherit prediction market state.
 * It only forwards validated messages to PredictionMarketCore.
 */
contract WormholeReceiver {

    // Custom Errors
    error ZeroWormholeAddress();
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

    // Wormhole Core Contract address (for VAA verification)
    address public immutable WORMHOLE_CORE;

    // Wormhole Chain ID for this receiver (10003 = Arbitrum Sepolia)
    uint16 public immutable CHAIN_ID;

    // Native EVM Chain ID (421614 = Arbitrum Sepolia)
    uint256 public immutable EVM_CHAIN_ID;

    // Reference to the prediction market core contract
    IPredictionMarket public immutable PREDICTION_MARKET;

    // Address that can register senders (owner)
    address public registrationOwner;

    // Mapping to store registered senders for each chain
    mapping(uint16 => bytes32) public registeredSenders;

    // Track processed VAA hashes to prevent replay attacks
    // Maps keccak256(vm.emitterAddress, vm.emitterChainId, vm.sequence) => bool
    mapping(bytes32 => bool) public processedVAAs;

    /**
     * @dev Constructor initializes WormholeReceiver with necessary addresses
     * @param wormholeCoreAddr Address of the Wormhole Core contract (for VAA verification)
     * @param chainId_ Wormhole Chain ID for this receiver (10003 = Arbitrum Sepolia)
     * @param evmChainId_ Native EVM Chain ID (421614 = Arbitrum Sepolia)
     * @param predictionMarketAddr Address of the PredictionMarketCore contract
     */
    constructor(
        address payable wormholeCoreAddr,
        uint16 chainId_,
        uint256 evmChainId_,
        address predictionMarketAddr
    ) {
        if (wormholeCoreAddr == address(0)) revert ZeroWormholeAddress();
        if (predictionMarketAddr == address(0)) revert ZeroPredictionMarketAddress();

        WORMHOLE_CORE = wormholeCoreAddr;
        CHAIN_ID = chainId_;
        EVM_CHAIN_ID = evmChainId_;
        PREDICTION_MARKET = IPredictionMarket(predictionMarketAddr);
        registrationOwner = msg.sender;
    }

    /**
     * @notice Get the Wormhole Core contract interface
     * @return IWormhole interface to the Wormhole Core contract
     */
    function wormhole() public view returns (IWormhole) {
        return IWormhole(WORMHOLE_CORE);
    }

    /**
     * @notice Check if contract is running on a fork
     * @return bool True if EVM_CHAIN_ID doesn't match block.chainid
     */
    function isFork() public view returns (bool) {
        return EVM_CHAIN_ID != block.chainid;
    }

    /**
     * @notice Main entry point for VAA verification and processing
     * @dev User/frontend calls this function with a signed VAA from Wormhole Guardians
     * @param encodedVm A byte array containing a VAA signed by the guardians
     */
    function verify(bytes memory encodedVm) external {
        (IWormhole.VM memory vm, bool valid, string memory reason) = wormhole().parseAndVerifyVM(encodedVm);

        require(valid, reason);
        require(_verifyAuthorizedEmitter(vm), "Invalid emitter: source not recognized");

        bytes32 vaaHash = keccak256(abi.encodePacked(vm.emitterAddress, vm.emitterChainId, vm.sequence));
        if (processedVAAs[vaaHash]) {
            revert MessageAlreadyProcessed(vaaHash);
        }

        processedVAAs[vaaHash] = true;

        bytes memory payload = vm.payload;

        if (payload.length == 0) revert EmptyPayload();

        // Skip first 32 bytes (txHash added by Wormhole guardians/agents)
        // Payload structure: txHash(32) | messageType(1) | ...
        uint8 messageType = uint8(payload[32]);

        emit MessageReceived(vm.emitterChainId, vm.emitterAddress, vaaHash, messageType, payload.length);

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
     * @dev Internal helper to verify if the VAA is from an authorized emitter
     * @param vm The parsed VAA (Verified Action Approval)
     * @return bool True if the emitter is registered and authorized
     */
    function _verifyAuthorizedEmitter(IWormhole.VM memory vm) internal view returns (bool) {
        bytes32 registeredSender = registeredSenders[vm.emitterChainId];
        return registeredSender != bytes32(0) && registeredSender == vm.emitterAddress;
    }


    /**
     * @dev Processes bet payload from Aztec (V3)
     * Payload structure (130 bytes): [txHash(32) | type(1) | marketId(32) | betId(32) | outcome(1) | amount(32)]
     * Note: Wormhole guardians/agents prepend txHash (32 bytes) to the payload
     */
    function _processBetPayload(bytes memory payload) internal {
        // Verify we're not running on a fork
        if (isFork()) revert ChainIdMismatch();

        // BET message: 32 bytes txHash + 98 bytes original payload = 130 bytes minimum
        // Note: payload may be longer due to chunk padding from Aztec (8 chunks × 31 bytes)
        if (payload.length < 130) revert PayloadTooShort(payload.length, 130);
        if (uint8(payload[32]) != 0x01) revert UnknownMessageType(uint8(payload[32]));

        uint256 marketId;
        bytes32 betId;
        bool outcome;
        uint256 amount;

        assembly {
            // payload structure: [txHash(32) | type(1) | marketId(32) | betId(32) | outcome(1) | amount(32)]
            // mload reads 32 bytes starting at given position
            // payload pointer points to length, so add 32 to get to data
            // All offsets are +32 compared to original to skip txHash

            marketId := mload(add(payload, 65))    // 32 (length) + 32 (txHash) + 1 (type) = 65
            betId := mload(add(payload, 97))       // 65 + 32 (marketId) = 97
            let outcomeRaw := byte(0, mload(add(payload, 129)))  // 97 + 32 (betId) = 129
            outcome := gt(outcomeRaw, 0)           // Convert to bool (0x00=false, 0x01=true)
            amount := mload(add(payload, 130))     // 129 + 1 (outcome) = 130
        }

        if (betId == bytes32(0)) revert InvalidBetId();
        if (amount == 0) revert ZeroAmount();

        PREDICTION_MARKET.processBet(marketId, betId, outcome, amount);

        emit BetReceived(marketId, betId, outcome, amount);
    }

    /**
     * @dev Processes claim authorization payload from Aztec (V3)
     * Payload structure (161 bytes): [txHash(32) | type(1) | marketId(32) | nullifier(32) | betAmount(32) | recipientField(32)]
     * Note: Wormhole guardians/agents prepend txHash (32 bytes) to the payload
     * Note: recipientField is a 32-byte Field from Aztec that contains the EVM address in the last 20 bytes
     */
    function _processClaimAuthPayload(bytes memory payload) internal {
        // Verify we're not running on a fork
        if (isFork()) revert ChainIdMismatch();

        // CLAIM_AUTHORIZATION message: 32 bytes txHash + 129 bytes original payload = 161 bytes minimum
        // Note: payload may be longer due to chunk padding from Aztec (8 chunks × 31 bytes)
        if (payload.length < 161) revert PayloadTooShort(payload.length, 161);
        if (uint8(payload[32]) != 0x02) revert UnknownMessageType(uint8(payload[32]));

        uint256 marketId;
        bytes32 nullifier;
        uint256 betAmount;
        address recipient;

        assembly {
            // payload structure: [txHash(32) | type(1) | marketId(32) | nullifier(32) | betAmount(32) | recipientField(32)]
            // Total: 161 bytes
            // mload reads 32 bytes starting at given position
            // payload pointer points to length, so add 32 to get to data
            // All offsets are +32 compared to original to skip txHash
            //
            // Memory layout:
            // [0-31]:    length
            // [32-63]:   txHash (added by Wormhole)
            // [64]:      type (0x02)
            // [65-96]:   marketId (bytes 33-64 of payload)
            // [97-128]:  nullifier (bytes 65-96)
            // [129-160]: betAmount (bytes 97-128)
            // [161-192]: recipientField (bytes 129-160) - 32 bytes Field containing address in last 20 bytes

            marketId := mload(add(payload, 65))        // 32 (length) + 32 (txHash) + 1 (type) = 65
            nullifier := mload(add(payload, 97))       // 65 + 32 (marketId) = 97
            betAmount := mload(add(payload, 129))      // 97 + 32 (nullifier) = 129

            // For recipientField (32 bytes at payload[129-160]):
            // The Field is big-endian and contains the address in the last 20 bytes
            // Extract the last 20 bytes by masking
            let recipientField := mload(add(payload, 161))  // 129 + 32 (betAmount) = 161
            recipient := and(recipientField, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)  // Mask to get last 20 bytes
        }

        // Validate extracted data (marketId validity checked by PREDICTION_MARKET)
        if (nullifier == bytes32(0)) revert InvalidNullifier();
        if (betAmount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroRecipient();

        // Call PredictionMarketCore to process the claim authorization
        PREDICTION_MARKET.processClaimAuthorization(marketId, nullifier, betAmount, recipient);

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