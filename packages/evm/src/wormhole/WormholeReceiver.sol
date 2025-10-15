// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {IWormhole} from "wormhole-foundation/ethereum/contracts/interfaces/IWormhole.sol";
import {PredictionMarketGetters} from "../core/PredictionMarketGetters.sol";
import {IPredictionMarket} from "../interfaces/IPredictionMarket.sol";

/**
 * @title WormholeReceiver
 * @dev Receives and manually processes VAAs from Aztec for prediction market bets
 * This contract runs on Arbitrum Sepolia and verifies cross-chain messages from Aztec
 *
 * IMPORTANT: Uses manual VAA verification pattern (not automatic Wormhole Relayer)
 * because Aztec is not an EVM chain and automatic relayer only supports EVM chains.
 */
contract WormholeReceiver is PredictionMarketGetters {

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

    // Address that can register senders (owner)
    address public registrationOwner;

    // Mapping to store registered senders for each chain
    mapping(uint16 => bytes32) public registeredSenders;

    // Track processed VAA hashes to prevent replay attacks
    // Maps keccak256(vm.emitterAddress, vm.emitterChainId, vm.sequence) => bool
    mapping(bytes32 => bool) public processedVAAs;

    /**
     * @dev Constructor initializes parent PredictionMarketGetters and sets core contract
     * @param wormholeCoreAddr Address of the Wormhole Core contract (for VAA verification)
     * @param chainId_ Wormhole Chain ID for this receiver (10003 = Arbitrum Sepolia)
     * @param evmChainId_ Native EVM Chain ID (421614 = Arbitrum Sepolia)
     * @param finality_ Number of confirmations required for finality
     * @param treasuryContractAddr Address of the treasury contract
     * @param predictionMarketAddr Address of the PredictionMarketCore contract
     */
    constructor(
        address payable wormholeCoreAddr,
        uint16 chainId_,
        uint256 evmChainId_,
        uint8 finality_,
        address treasuryContractAddr,
        address predictionMarketAddr
    ) PredictionMarketGetters(chainId_, evmChainId_, finality_, treasuryContractAddr) {
        if (predictionMarketAddr == address(0)) revert ZeroPredictionMarketAddress();

        // Store Wormhole Core reference in state (inherited from PredictionMarketState)
        _state.wormholeAddr = wormholeCoreAddr;

        PREDICTION_MARKET = IPredictionMarket(predictionMarketAddr);
        registrationOwner = msg.sender;
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
        uint8 messageType = uint8(payload[0]);

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

        if (betId == bytes32(0)) revert InvalidBetId();
        if (amount == 0) revert ZeroAmount();

        PREDICTION_MARKET.processBet(marketId, betId, outcome, amount);

        emit BetReceived(marketId, betId, outcome, amount);
    }

    /**
     * @dev Processes claim authorization payload from Aztec (V3)
     * Payload structure (149 bytes): [type(1) | marketId(32) | nullifier(32) | betAmount(32) | recipient(20) | deadline(32)]
     */
    function _processClaimAuthPayload(bytes memory payload) internal {
        // Verify we're not running on a fork
        if (isFork()) revert ChainIdMismatch();

        // V3 CLAIM_AUTHORIZATION message: exactly 149 bytes
        if (payload.length != 149) revert PayloadTooShort(payload.length, 149);
        if (uint8(payload[0]) != 0x02) revert UnknownMessageType(uint8(payload[0]));

        uint256 marketId;
        bytes32 nullifier;
        uint256 betAmount;
        address recipient;
        uint256 deadline;

        assembly {
            // payload structure: [type(1) | marketId(32) | nullifier(32) | betAmount(32) | recipient(20) | deadline(32)]
            // Total: 149 bytes (abi.encodePacked does NOT pad the 20-byte address)
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
            // [149-180]: deadline (bytes 117-148)

            marketId := mload(add(payload, 33))        // Bytes 1-32
            nullifier := mload(add(payload, 65))       // Bytes 33-64
            betAmount := mload(add(payload, 97))       // Bytes 65-96

            // For address (20 bytes at payload[97-116]):
            // mload(129) reads bytes 97-128 (32 bytes starting at offset 97)
            // We want the FIRST 20 bytes of those 32 bytes
            // Shift right by 96 bits (12 bytes) to discard the trailing 12 bytes
            let recipientBytes := mload(add(payload, 129))
            recipient := shr(96, recipientBytes)

            deadline := mload(add(payload, 149))       // Bytes 117-148
        }

        // Validate extracted data (marketId validity checked by PREDICTION_MARKET)
        if (nullifier == bytes32(0)) revert InvalidNullifier();
        if (betAmount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroRecipient();

        // Call PredictionMarketCore to process the claim authorization
        PREDICTION_MARKET.processClaimAuthorization(marketId, nullifier, betAmount, recipient, deadline);

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