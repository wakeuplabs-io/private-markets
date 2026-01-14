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
     * @dev Debug event to inspect raw payload bytes
     */
    event PayloadDebug(bytes payload, uint256 length, bytes32 first32Bytes);

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

    // Payload format from Aztec Wormhole (real format discovered from testnet):
    // - Bytes 0-31: txId (32 bytes) - Aztec transaction hash
    // - Byte 32: messageType (0x01=BET, 0x02=CLAIM)
    // - Byte 33: outcome (only for BET: 0x02=NO, 0x03=YES)
    // - Bytes 34-64: chunk1 - marketId in Little Endian (31 bytes)
    // - Bytes 65-95: chunk2 - betId/nullifier in Little Endian (31 bytes)
    // - Bytes 96-126: chunk3 - amount in Little Endian (31 bytes)
    // - Bytes 127+: chunk4+ - additional data (recipient for CLAIM)
    //
    // Total payload is ~136 bytes (compressed, trailing zeros removed)
    uint256 constant TX_ID_SIZE = 32;
    uint256 constant CHUNK_SIZE = 31;

    // Scale factor to restore compressed amounts from Aztec serialization
    // Aztec strips trailing zero bytes from LE representation
    // For 18-decimal tokens, amounts typically have 2 trailing zero bytes
    // Factor: 65536 (decimal) = 0x10000 (hex) = 2^16
    uint256 constant AMOUNT_SCALE_FACTOR = 65536;

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

        // Debug: emit first 32 bytes of payload to inspect format
        bytes32 first32;
        if (payload.length >= 32) {
            assembly {
                first32 := mload(add(payload, 32))
            }
        }
        emit PayloadDebug(payload, payload.length, first32);

        // Payload format from Aztec Wormhole (discovered from testnet):
        // - Bytes 0-31: txId (32 bytes)
        // - Byte 32: messageType
        // - Byte 33+: message-specific data
        //
        // messageType is at byte 32 (right after txId)
        uint8 messageType = uint8(payload[TX_ID_SIZE]);

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
     * @dev Reads a uint256 from payload in Little Endian format
     * @param data The payload bytes
     * @param offset Starting position in payload
     * @param length Number of bytes to read (max 32)
     * @return The uint256 value
     */
    function _readUint256LE(bytes memory data, uint256 offset, uint256 length) internal pure returns (uint256) {
        uint256 result = 0;
        uint256 maxLen = length > 32 ? 32 : length;
        for (uint256 i = 0; i < maxLen && (offset + i) < data.length; i++) {
            result |= uint256(uint8(data[offset + i])) << (i * 8);
        }
        return result;
    }

    /**
     * @dev Reads a bytes32 from payload in Little Endian format
     * @param data The payload bytes
     * @param offset Starting position in payload
     * @param length Number of bytes to read
     * @return The bytes32 value
     */
    function _readBytes32LE(bytes memory data, uint256 offset, uint256 length) internal pure returns (bytes32) {
        return bytes32(_readUint256LE(data, offset, length));
    }

    /**
     * @dev Reads an address from payload in Little Endian format
     * @param data The payload bytes
     * @param offset Starting position in payload
     * @return The address value (20 bytes)
     */
    function _readAddressLE(bytes memory data, uint256 offset) internal pure returns (address) {
        uint256 value = _readUint256LE(data, offset, 20);
        return address(uint160(value));
    }

    /**
     * @dev Reads amount from the amount chunk in Little Endian format
     *
     * Aztec format: [leading zero padding][value bytes in LE at END]
     * We skip leading zeros and read the remaining bytes as LE.
     *
     * Example for 10e18 in Aztec format:
     *   Chunk (40 bytes): [34 zero bytes][e8 89 04 23 c7 8a]
     *   Skip zeros, read 6 bytes in LE: e8 + (89<<8) + (04<<16) + (23<<24) + (c7<<32) + (8a<<40)
     *   Result: 0x8ac7230489e8
     *
     * NOTE: Aztec compresses trailing zeros from the LE representation.
     * 10e18 = 0x8ac7230489e80000 becomes 0x8ac7230489e8 (loses 2 bytes = factor of 65536)
     *
     * @param data The payload bytes
     * @param fixedHeaderSize Size of the fixed header before amount chunk
     * @return The uint256 value (compressed - may need scaling)
     */
    function _readAmountChunk(bytes memory data, uint256 fixedHeaderSize) internal pure returns (uint256) {
        if (data.length <= fixedHeaderSize) {
            return 0;
        }

        // Find first non-zero byte in the chunk (skip leading zeros)
        uint256 valueStart = fixedHeaderSize;
        while (valueStart < data.length && uint8(data[valueStart]) == 0) {
            valueStart++;
        }

        // Calculate how many value bytes we have
        uint256 valueBytes = data.length - valueStart;
        if (valueBytes == 0) return 0;
        if (valueBytes > 32) valueBytes = 32;

        // Read the value bytes in Little Endian (byte 0 is LSB)
        uint256 result = 0;
        for (uint256 i = 0; i < valueBytes; i++) {
            uint8 b = uint8(data[valueStart + i]);
            result |= uint256(b) << (i * 8);
        }

        return result;
    }

    /**
     * @dev Processes bet payload from Aztec Wormhole
     * Payload format (discovered from testnet, ~136 bytes):
     *   Bytes 0-31: txId (32 bytes)
     *   Byte 32: messageType (0x01) - already validated in verify()
     *   Byte 33: outcome (0x00=NO, 0x01=YES)
     *   Bytes 34-64: marketId in Little Endian (31 bytes)
     *   Bytes 65-95: betId in Little Endian (31 bytes)
     *   Bytes 96+: amount chunk (leading zeros + LE value at end)
     *
     * NOTE: Aztec serializes the amount with leading zeros padding.
     * The actual amount value is at the END of the chunk in standard LE format.
     * Example: 00...00 00 e8 89 04 23 c7 8a = 10e18 in LE
     */
    function _processBetPayload(bytes memory payload) internal {
        // Verify we're not running on a fork
        if (isFork()) revert ChainIdMismatch();

        // BET message needs at least: txId(32) + type(1) + outcome(1) + marketId(31) + betId(31) + amount(1)
        // Minimum: 97 bytes
        if (payload.length < 97) revert PayloadTooShort(payload.length, 97);

        // Byte 33: outcome (2=NO, 3=YES for robust 2-bit encoding)
        uint8 outcomeRaw = uint8(payload[TX_ID_SIZE + 1]);
        require(outcomeRaw == 2 || outcomeRaw == 3, "Invalid outcome: must be 2 (NO) or 3 (YES)");
        bool outcome = outcomeRaw == 3;

        // Bytes 34-64: marketId in LE (31 bytes = CHUNK_SIZE)
        uint256 marketId = _readUint256LE(payload, TX_ID_SIZE + 2, CHUNK_SIZE);

        // Bytes 65-95: betId in LE (31 bytes)
        bytes32 betId = _readBytes32LE(payload, TX_ID_SIZE + 2 + CHUNK_SIZE, CHUNK_SIZE);

        // Bytes 96+: amount chunk (entire chunk is the amount in LE format)
        // Fixed header = txId(32) + type(1) + outcome(1) + marketId(31) + betId(31) = 96
        uint256 BET_FIXED_HEADER = TX_ID_SIZE + 2 + CHUNK_SIZE + CHUNK_SIZE; // 96
        uint256 compressedAmount = _readAmountChunk(payload, BET_FIXED_HEADER);

        // Scale up to restore original amount (Aztec strips 2 trailing zero bytes)
        uint256 amount = compressedAmount * AMOUNT_SCALE_FACTOR;

        if (betId == bytes32(0)) revert InvalidBetId();
        if (amount == 0) revert ZeroAmount();

        PREDICTION_MARKET.processBet(marketId, betId, outcome, amount);

        emit BetReceived(marketId, betId, outcome, amount);
    }

    /**
     * @dev Processes claim authorization payload from Aztec Wormhole
     * Payload format (compressed, trailing zeros removed from chunks):
     *   Bytes 0-31: txId (32 bytes)
     *   Byte 32: messageType (0x02)
     *   Bytes 33-63: marketId in Little Endian (31 bytes)
     *   Bytes 64-94: nullifier in Little Endian (31 bytes)
     *   Bytes 95+: recipient chunk (variable, ~21 bytes with leading zeros)
     *   After recipient: betAmount chunk (variable, ~8 bytes with leading zeros)
     *
     * NOTE: Recipient and amount chunks have leading zero padding that must be skipped.
     * The recipient is a 20-byte ETH address in LE format.
     */
    function _processClaimAuthPayload(bytes memory payload) internal {
        // Verify we're not running on a fork
        if (isFork()) revert ChainIdMismatch();

        // CLAIM minimum: txId(32) + type(1) + marketId(31) + nullifier(31) + recipient(~21) + amount(1) = 117
        if (payload.length < 117) revert PayloadTooShort(payload.length, 117);

        // Bytes 33-63: marketId in LE (31 bytes)
        uint256 marketId = _readUint256LE(payload, TX_ID_SIZE + 1, CHUNK_SIZE);

        // Bytes 64-94: nullifier in LE (31 bytes)
        bytes32 nullifier = _readBytes32LE(payload, TX_ID_SIZE + 1 + CHUNK_SIZE, CHUNK_SIZE);

        // Bytes 95+: recipient chunk (variable, ~21 bytes with leading zero padding)
        // Skip the leading zero bytes and read 20 bytes for the address
        uint256 recipientChunkStart = TX_ID_SIZE + 1 + CHUNK_SIZE + CHUNK_SIZE; // 95

        // Find first non-zero byte in recipient chunk (skip leading zeros)
        uint256 addrStart = recipientChunkStart;
        while (addrStart < payload.length && uint8(payload[addrStart]) == 0) {
            addrStart++;
        }

        // Read 20 bytes as address in LE
        address recipient = _readAddressLE(payload, addrStart);

        // Amount starts 20 bytes after addrStart
        uint256 amountStart = addrStart + 20;
        uint256 compressedBetAmount = _readAmountChunk(payload, amountStart);

        // Scale up to restore original amount (Aztec strips 2 trailing zero bytes)
        uint256 betAmount = compressedBetAmount * AMOUNT_SCALE_FACTOR;

        // Validate extracted data
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