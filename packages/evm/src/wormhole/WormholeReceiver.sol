// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {BytesLib} from "wormhole-foundation/ethereum/contracts/libraries/external/BytesLib.sol";
import {IWormhole} from "wormhole-foundation/ethereum/contracts/interfaces/IWormhole.sol";
import {PredictionMarketGetters} from "../core/PredictionMarketGetters.sol";
import {IPredictionMarket} from "../interfaces/IPredictionMarket.sol";

/**
 * @title WormholeReceiver
 * @dev Receives and processes VAAs from Aztec for prediction market bets
 * This contract runs on Arbitrum Sepolia and receives cross-chain messages from Aztec
 */
contract WormholeReceiver is PredictionMarketGetters {
    using BytesLib for bytes;

    // Custom Errors
    error ZeroPredictionMarketAddress();
    error InvalidVAASignature(string reason);
    error UnauthorizedEmitter();
    error ChainIdMismatch();
    error PayloadTooShort(uint256 provided, uint256 required);
    error InvalidMarketId();
    error InvalidBetId();
    error ZeroAmount();
    error InvalidCommitment();
    error ZeroEmitterAddress();

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

    /**
     * @dev Constructor initializes parent PredictionMarketGetters and sets core contract
     * @param wormholeAddr Address of the Wormhole contract
     * @param chainId_ Wormhole Chain ID for this receiver (10003 = Arbitrum Sepolia)
     * @param evmChainId_ Native EVM Chain ID (421614 = Arbitrum Sepolia)
     * @param finality_ Number of confirmations required for finality
     * @param treasuryContractAddr Address of the treasury contract
     * @param predictionMarketAddr Address of the PredictionMarketCore contract
     */
    constructor(
        address payable wormholeAddr,
        uint16 chainId_,
        uint256 evmChainId_,
        uint8 finality_,
        address treasuryContractAddr,
        address predictionMarketAddr
    ) PredictionMarketGetters(wormholeAddr, chainId_, evmChainId_, finality_, treasuryContractAddr) {
        if (predictionMarketAddr == address(0)) revert ZeroPredictionMarketAddress();
        PREDICTION_MARKET = IPredictionMarket(predictionMarketAddr);
    }

    /**
     * @notice Verifies a VAA (Verified Action Approval) and processes the bet
     * @dev Validates that a VAA is properly signed and forwards bet to PredictionMarketCore
     * @param encodedVm A byte array containing a VAA signed by the guardians
     */
    function processBetVaa(bytes memory encodedVm) external {
        // Get the payload by verifying the VAA
        bytes memory payload = _verify(encodedVm);

        // Extract and process bet data from the payload
        _processBetPayload(payload);
    }

    /**
     * @dev Internal verification function for VAAs
     * @param encodedVm A byte array containing a VAA signed by the guardians
     * @return bytes The payload of the VAA if verification succeeds
     */
    function _verify(bytes memory encodedVm) internal view returns (bytes memory) {
        // Parse and verify the VAA through Wormhole
        (IWormhole.VM memory vm, bool valid, string memory reason) = wormhole().parseAndVerifyVM(encodedVm);

        // Ensure the VAA signature is valid
        if (!valid) revert InvalidVAASignature(reason);

        // Ensure the VAA is from a valid emitter
        if (!verifyAuthorizedEmitter(vm)) revert UnauthorizedEmitter();

        return vm.payload;
    }

    /**
     * @dev Processes bet payload from Aztec
     * Expected payload structure:
     * - uint256 marketId (32 bytes)
     * - bytes32 betId (32 bytes)
     * - bool outcome (1 byte: 0x00 = No/false, 0x01 = Yes/true)
     * - uint256 amount (32 bytes)
     * - bytes32 commitment (32 bytes)
     * Total: 129 bytes minimum
     */
    function _processBetPayload(bytes memory payload) internal {
        // Verify we're not running on a fork
        if (isFork()) revert ChainIdMismatch();

        // Ensure payload is long enough for bet data
        if (payload.length < 129) revert PayloadTooShort(payload.length, 129);

        uint256 marketId;
        bytes32 betId;
        bool outcome;
        uint256 amount;
        bytes32 commitment;

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
     * @dev Verifies that a VAA is from a registered authorized emitter
     * @param vm The parsed Wormhole VM structure
     * @return bool True if the emitter is authorized
     */
    function verifyAuthorizedEmitter(IWormhole.VM memory vm) internal view returns (bool) {
        // Check if the emitter is registered for this chain
        bytes32 registeredEmitter = getRegisteredEmitter(vm.emitterChainId);

        // Return true if the emitter matches the registered one
        return registeredEmitter == vm.emitterAddress;
    }

    /**
     * @notice Registers an emitter from another chain for verification
     * @dev Only the owner can register emitters
     * @param chainId_ The Wormhole chain ID of the emitter (e.g., 56 for Aztec)
     * @param emitterAddress_ The emitter contract address as bytes32
     */
    function registerEmitter(uint16 chainId_, bytes32 emitterAddress_) external onlyOwner {
        if (emitterAddress_ == bytes32(0)) revert ZeroEmitterAddress();

        _state.registeredEmitters[chainId_] = emitterAddress_;

        emit EmitterRegistered(chainId_, emitterAddress_);
    }
}