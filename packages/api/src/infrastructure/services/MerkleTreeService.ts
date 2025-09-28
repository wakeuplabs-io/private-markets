/**
 * @fileoverview Merkle Tree service implementation
 * Handles Merkle tree construction with H(commitment, amount) leaves for market resolution
 *
 * @module infrastructure/services/MerkleTreeService
 */

import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'viem';
import type { Logger } from 'pino';
import type {
  IMerkleService,
  MerkleProof,
  MerkleTreeResult
} from '../../domain/services/IMerkleService';

/**
 * Implementation of Merkle tree operations for prediction market resolution
 */
export class MerkleTreeService implements IMerkleService {
  constructor(private logger: Logger) {}

  /**
   * Builds a Merkle tree from commitment-amount pairs
   */
  async buildTree(commitmentAmountPairs: Array<[string, string]>): Promise<MerkleTreeResult> {
    this.logger.info({
      pairCount: commitmentAmountPairs.length,
      pairs: commitmentAmountPairs.map(([commitment, amount]) => ({
        commitment: commitment.slice(0, 10) + '...',
        amount
      }))
    }, 'Building Merkle tree');

    if (commitmentAmountPairs.length === 0) {
      this.logger.warn('Building tree with no commitment pairs');
      throw new Error('Cannot build Merkle tree with empty commitment pairs');
    }

    // Create leaf hashes: H(commitment, amount)
    const leaves = commitmentAmountPairs.map(([commitment, amount]) =>
      this.createLeafHash(commitment, amount)
    );

    this.logger.info({
      leafCount: leaves.length,
      sampleLeaves: leaves.slice(0, 3).map(leaf => leaf.slice(0, 10) + '...')
    }, 'Generated leaf hashes');

    // Build the Merkle tree
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    this.logger.info({
      root,
      treeHeight: tree.getDepth(),
      leafCount: leaves.length
    }, 'Merkle tree constructed');

    // Generate proofs for all commitments
    const proofs = new Map<string, MerkleProof>();

    for (let i = 0; i < commitmentAmountPairs.length; i++) {
      const [commitment, amount] = commitmentAmountPairs[i];
      const leaf = leaves[i];
      const proof = tree.getHexProof(leaf);

      proofs.set(commitment, {
        commitment,
        amount,
        proof,
        leafIndex: i
      });

      this.logger.debug({
        commitment: commitment.slice(0, 10) + '...',
        amount,
        proofLength: proof.length,
        leafIndex: i
      }, 'Generated proof for commitment');
    }

    this.logger.info({
      root,
      proofCount: proofs.size,
      totalAmount: this.calculateTotalAmount(commitmentAmountPairs)
    }, 'Merkle tree build completed');

    return {
      root,
      proofs,
      leafCount: leaves.length
    };
  }

  /**
   * Generates a single proof for a commitment
   */
  async generateProof(
    commitment: string,
    amount: string,
    allCommitmentAmountPairs: Array<[string, string]>
  ): Promise<MerkleProof | null> {
    this.logger.info({
      commitment: commitment.slice(0, 10) + '...',
      amount,
      totalPairs: allCommitmentAmountPairs.length
    }, 'Generating single proof');

    // Find the commitment in the pairs
    const targetIndex = allCommitmentAmountPairs.findIndex(
      ([c, a]) => c === commitment && a === amount
    );

    if (targetIndex === -1) {
      this.logger.warn({
        commitment: commitment.slice(0, 10) + '...',
        amount
      }, 'Commitment not found in pairs');
      return null;
    }

    const treeResult = await this.buildTree(allCommitmentAmountPairs);
    const proof = treeResult.proofs.get(commitment);

    if (!proof) {
      this.logger.error({
        commitment: commitment.slice(0, 10) + '...',
        amount
      }, 'Failed to generate proof for existing commitment');
      return null;
    }

    this.logger.info({
      commitment: commitment.slice(0, 10) + '...',
      proofLength: proof.proof.length,
      leafIndex: proof.leafIndex
    }, 'Single proof generated successfully');

    return proof;
  }

  /**
   * Verifies a Merkle proof against a root
   */
  async verifyProof(
    commitment: string,
    amount: string,
    proof: string[],
    root: string
  ): Promise<boolean> {
    this.logger.debug({
      commitment: commitment.slice(0, 10) + '...',
      amount,
      proofLength: proof.length,
      root: root.slice(0, 10) + '...'
    }, 'Verifying Merkle proof');

    try {
      
      const leaf = this.createLeafHash(commitment, amount);

      const isValid = MerkleTree.verify(proof, leaf, root, keccak256, { sortPairs: true });

      this.logger.info({
        commitment: commitment.slice(0, 10) + '...',
        amount,
        isValid,
        leaf: leaf.slice(0, 10) + '...'
      }, 'Proof verification completed');

      return isValid;
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : String(error),
        commitment: commitment.slice(0, 10) + '...',
        amount
      }, 'Error during proof verification');

      return false;
    }
  }

  /**
   * Creates the leaf hash for a commitment-amount pair
   * Uses keccak256(abi.encodePacked(commitment, amount))
   */
  createLeafHash(commitment: string, amount: string): string {
    // Convert amount to bytes32 (pad to 32 bytes)
    const amountBigInt = BigInt(amount);
    const amountBytes = amountBigInt.toString(16).padStart(64, '0');
    const amountHex = '0x' + amountBytes;

    const packed = commitment + amountHex.slice(2); 

    const leafHash = keccak256(packed as `0x${string}`);

    this.logger.debug({
      commitment: commitment.slice(0, 10) + '...',
      amount,
      amountHex: amountHex.slice(0, 10) + '...',
      packed: packed.slice(0, 20) + '...',
      leafHash: leafHash.slice(0, 10) + '...'
    }, 'Created leaf hash');

    return leafHash;
  }

  /**
   * Gets tree statistics for debugging/monitoring
   */
  getTreeStats(commitmentAmountPairs: Array<[string, string]>): {
    leafCount: number;
    treeHeight: number;
    totalAmount: string;
  } {
    const leafCount = commitmentAmountPairs.length;
    const treeHeight = leafCount > 0 ? Math.ceil(Math.log2(leafCount)) : 0;
    const totalAmount = this.calculateTotalAmount(commitmentAmountPairs);

    this.logger.debug({
      leafCount,
      treeHeight,
      totalAmount
    }, 'Calculated tree statistics');

    return {
      leafCount,
      treeHeight,
      totalAmount
    };
  }

  /**
   * Helper to calculate total amount from commitment pairs
   */
  private calculateTotalAmount(commitmentAmountPairs: Array<[string, string]>): string {
    const total = commitmentAmountPairs.reduce(
      (sum, [, amount]) => sum + BigInt(amount),
      BigInt(0)
    );
    return total.toString();
  }
}