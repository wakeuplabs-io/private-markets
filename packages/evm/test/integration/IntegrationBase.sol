// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PredictionMarketCore} from "../../src/core/PredictionMarketCore.sol";
import {Treasury} from "../../src/Treasury.sol";
import {WormholeReceiver} from "../../src/WormholeReceiver.sol";
import {MockERC20} from "../../src/MockERC20.sol";

import {IWormhole} from "wormhole-foundation/ethereum/contracts/interfaces/IWormhole.sol";

contract MockWormhole {
    uint64 private sequence;
    
    function parseAndVerifyVM(bytes memory encodedVm) external returns (IWormhole.VM memory vm, bool valid, string memory reason) {
        (bytes memory payload, uint64 seq) = abi.decode(encodedVm, (bytes, uint64));
        bytes32 vaaHash = keccak256(encodedVm);
        
        vm = IWormhole.VM({
            version: 1,
            timestamp: uint32(block.timestamp),
            nonce: 1,
            emitterChainId: 56,
            emitterAddress: 0x0f8a2300a7925c586135b1c142dc0b833f20d5c41ea6e815900d65d041e96cf5,
            sequence: seq,
            consistencyLevel: 200,
            payload: payload,
            guardianSetIndex: 0,
            signatures: new IWormhole.Signature[](0),
            hash: vaaHash
        });
        
        valid = true;
        reason = "";
    }
}


contract IntegrationBase is Test {
    uint16 internal constant WORMHOLE_CHAIN_ID = 10003;
    uint256 internal constant EVM_CHAIN_ID = 31337;
    uint8 internal constant FINALITY = 1;
    uint16 internal constant AZTEC_CHAIN_ID = 56;
    bytes32 internal constant AZTEC_PREDICTION_CONTRACT = 0x0f8a2300a7925c586135b1c142dc0b833f20d5c41ea6e815900d65d041e96cf5;

    address internal admin = makeAddr("admin");
    address internal user1 = makeAddr("user1");
    address internal user2 = makeAddr("user2");
    address internal owner = makeAddr("owner");

    MockWormhole internal mockWormhole;
    MockERC20 internal mockErc20;
    Treasury internal treasury;
    PredictionMarketCore internal predictionMarket;
    WormholeReceiver internal wormholeReceiver;

    function setUp() public virtual {
        vm.startPrank(owner);

        mockWormhole = new MockWormhole();
        mockErc20 = new MockERC20("Mock Token", "MTK", 18, 1_000_000_000 * 10**18);
        treasury = new Treasury(address(mockErc20));
        predictionMarket = new PredictionMarketCore(WORMHOLE_CHAIN_ID, EVM_CHAIN_ID, FINALITY, address(treasury));
        wormholeReceiver = new WormholeReceiver(
            payable(address(mockWormhole)),
            WORMHOLE_CHAIN_ID,
            EVM_CHAIN_ID,
            address(predictionMarket)
        );

        wormholeReceiver.setRegisteredSender(AZTEC_CHAIN_ID, AZTEC_PREDICTION_CONTRACT);
        predictionMarket.transferOwnership(address(wormholeReceiver));
        treasury.transferOwnership(address(predictionMarket));

        mockErc20.mint(user1, 10_000 * 10**18);
        mockErc20.mint(user2, 10_000 * 10**18);
        mockErc20.mint(owner, 100_000 * 10**18);

        vm.stopPrank();
    }


    uint64 private mockSequence;

    // Payload format constants (discovered from Aztec testnet)
    uint256 constant TX_ID_SIZE = 32;
    uint256 constant CHUNK_SIZE = 31;

    /**
     * @dev Creates a mock VAA with payload
     */
    function createMockVaa(bytes memory payload) internal returns (bytes memory) {
        mockSequence++;
        return abi.encode(payload, mockSequence);
    }

    /**
     * @dev Creates a BET payload matching the real Aztec Wormhole format
     * Format (discovered from testnet, 136 bytes):
     *   Bytes 0-31: txId (32 bytes) - random hash for mock
     *   Byte 32: messageType (0x01 for BET)
     *   Byte 33: outcome (0x00=NO, 0x01=YES)
     *   Bytes 34-64: marketId in Little Endian (31 bytes)
     *   Bytes 65-95: betId in Little Endian (31 bytes)
     *   Bytes 96-135: amount chunk (40 bytes = leading zeros + LE value at END)
     *
     * NOTE: The amount value is written in LE at the END of the chunk.
     */
    function createBetPayload(
        uint256 marketId,
        bytes32 betId,
        bool outcome,
        uint256 amount
    ) internal pure returns (bytes memory) {
        // Total: txId(32) + type(1) + outcome(1) + marketId(31) + betId(31) + amount_chunk(40) = 136 bytes
        bytes memory payload = new bytes(136);

        // Bytes 0-31: txId (mock with zeros, real VAA has actual txId)
        // Left as zeros for mock

        // Byte 32: messageType = 0x01 (BET)
        payload[TX_ID_SIZE] = 0x01;

        // Byte 33: outcome
        payload[TX_ID_SIZE + 1] = outcome ? bytes1(0x01) : bytes1(0x00);

        // Bytes 34-64: marketId in LE (31 bytes)
        _writeChunkLE(payload, TX_ID_SIZE + 2, marketId);

        // Bytes 65-95: betId in LE (31 bytes)
        _writeChunkLE(payload, TX_ID_SIZE + 2 + CHUNK_SIZE, uint256(betId));

        // Bytes 96-135: amount chunk (40 bytes = leading zeros + LE value at END)
        _writeAmountAtEnd(payload, amount);

        return payload;
    }

    /**
     * @dev Writes amount at the END of the payload in Little Endian format.
     *
     * Real Aztec/Wormhole format (from testnet):
     *   Amount chunk is 40 bytes (bytes 96-135)
     *   Value is written at the END in Little Endian
     *   Leading bytes are zeros (padding)
     *
     * Example for 10e18 = 0x8ac7230489e80000:
     *   In LE: 00 00 e8 89 04 23 c7 8a (8 bytes)
     *   Written at: payload[128..135] (last 8 bytes of 40-byte chunk)
     *   Chunk: [32 zeros][00 00 e8 89 04 23 c7 8a]
     */
    function _writeAmountAtEnd(bytes memory payload, uint256 value) internal pure {
        // Write value in LE starting from the END of the payload
        // We write up to 32 bytes (or less if payload is shorter)
        uint256 bytesToWrite = 32;
        if (bytesToWrite > payload.length) bytesToWrite = payload.length;

        // Write from the end, in Little Endian (low byte first)
        for (uint256 i = 0; i < bytesToWrite; i++) {
            uint256 pos = payload.length - bytesToWrite + i;
            payload[pos] = bytes1(uint8(value >> (i * 8)));
        }
    }

    /**
     * @dev Creates a CLAIM payload matching the real Aztec Wormhole format
     * Format:
     *   Bytes 0-31: txId (32 bytes)
     *   Byte 32: messageType (0x02 for CLAIM)
     *   Bytes 33-63: marketId in Little Endian (31 bytes)
     *   Bytes 64-94: nullifier in Little Endian (31 bytes)
     *   Bytes 95-125: betAmount in Little Endian (31 bytes)
     *   Bytes 126-156: recipient in Little Endian (31 bytes, only 20 used for address)
     */
    function createClaimPayload(
        uint256 marketId,
        bytes32 nullifier,
        uint256 betAmount,
        address recipient
    ) internal pure returns (bytes memory) {
        // Total: txId(32) + type(1) + marketId(31) + nullifier(31) + amount(31) + recipient(31) = 157 bytes
        bytes memory payload = new bytes(157);

        // Bytes 0-31: txId (mock with zeros)
        // Left as zeros for mock

        // Byte 32: messageType = 0x02 (CLAIM)
        payload[TX_ID_SIZE] = 0x02;

        // Bytes 33-63: marketId in LE (31 bytes)
        _writeChunkLE(payload, TX_ID_SIZE + 1, marketId);

        // Bytes 64-94: nullifier in LE (31 bytes)
        _writeChunkLE(payload, TX_ID_SIZE + 1 + CHUNK_SIZE, uint256(nullifier));

        // Bytes 95-125: betAmount in LE (31 bytes)
        _writeChunkLE(payload, TX_ID_SIZE + 1 + CHUNK_SIZE + CHUNK_SIZE, betAmount);

        // Bytes 126-156: recipient in LE (address is 20 bytes, pad to 31)
        _writeChunkLE(payload, TX_ID_SIZE + 1 + CHUNK_SIZE + CHUNK_SIZE + CHUNK_SIZE, uint256(uint160(recipient)));

        return payload;
    }

    /**
     * @dev Writes a value in Little Endian format as a 31-byte chunk
     */
    function _writeChunkLE(bytes memory payload, uint256 offset, uint256 value) internal pure {
        for (uint256 i = 0; i < CHUNK_SIZE && (offset + i) < payload.length; i++) {
            payload[offset + i] = bytes1(uint8(value >> (i * 8)));
        }
    }
}