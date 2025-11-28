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
        mockErc20 = new MockERC20("Mock USDC", "USDC", 6, 1_000_000_000 * 10**6);
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

        mockErc20.mint(user1, 10_000 * 10**6);
        mockErc20.mint(user2, 10_000 * 10**6);
        mockErc20.mint(owner, 100_000 * 10**6);

        vm.stopPrank();
    }


    uint64 private mockSequence;
    
    function createMockVaa(bytes memory payload) internal returns (bytes memory) {
        mockSequence++;
        // Prepend dummy txHash (32 bytes) to simulate Wormhole guardian behavior
        bytes32 dummyTxHash = keccak256(abi.encodePacked(mockSequence, block.timestamp));
        bytes memory payloadWithTxHash = abi.encodePacked(dummyTxHash, payload);
        return abi.encode(payloadWithTxHash, mockSequence);
    }
}