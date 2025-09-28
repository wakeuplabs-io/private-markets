/**
 * @fileoverview Merkle Tree service interface
 * Defines the contract for Merkle tree operations in the prediction market system
 *
 * @module domain/services/IMerkleService
 */

/**
 * Represents a Merkle proof for a specific commitment
 */
export interface MerkleProof {
  /** The commitment hash */
  commitment: string;
  /** The original bet amount in wei */
  amount: string;
  /** Array of sibling hashes for proof verification */
  proof: string[];
  /** The leaf index in the tree */
  leafIndex: number;
}

/**
 * Result of building a Merkle tree
 */
export interface MerkleTreeResult {
  /** The Merkle root hash */
  root: string;
  /** Map of commitment to its proof data */
  proofs: Map<string, MerkleProof>;
  /** Total number of leaves in the tree */
  leafCount: number;
}

/**
 * Interface for Merkle tree operations
 * Handles tree construction with H(commitment, amount) leaves for market resolution
 */
export interface IMerkleService {
  /**
   * Builds a Merkle tree from commitment-amount pairs
   * Uses H(commitment, amount) as leaf construction for trust minimization
   *
   * @param commitmentAmountPairs - Array of [commitment, amount] pairs for winning bets
   * @returns Promise resolving to Merkle tree result with root and all proofs
   *
   * @example
   * ```typescript
   * const pairs = [
   *   ['0xabc...', '1000000000000000000'], // 1 ETH bet
   *   ['0xdef...', '500000000000000000']   // 0.5 ETH bet
   * ];
   * const result = await merkleService.buildTree(pairs);
   * console.log(result.root); // '0x123...'
   * ```
   */
  buildTree(commitmentAmountPairs: Array<[string, string]>): Promise<MerkleTreeResult>;

  /**
   * Generates a single proof for a commitment
   * Used when only one proof is needed instead of building full tree
   *
   * @param commitment - The commitment hash to generate proof for
   * @param amount - The bet amount in wei
   * @param allCommitmentAmountPairs - All winning bets for tree construction
   * @returns Promise resolving to proof data or null if commitment not found
   */
  generateProof(
    commitment: string,
    amount: string,
    allCommitmentAmountPairs: Array<[string, string]>
  ): Promise<MerkleProof | null>;

  /**
   * Verifies a Merkle proof against a root
   * Used for independent verification of proofs
   *
   * @param commitment - The commitment being proven
   * @param amount - The bet amount being proven
   * @param proof - Array of sibling hashes
   * @param root - The Merkle root to verify against
   * @returns Promise resolving to true if proof is valid
   *
   * @example
   * ```typescript
   * const isValid = await merkleService.verifyProof(
   *   '0xabc...',
   *   '1000000000000000000',
   *   ['0x123...', '0x456...'],
   *   '0xroot...'
   * );
   * ```
   */
  verifyProof(
    commitment: string,
    amount: string,
    proof: string[],
    root: string
  ): Promise<boolean>;

  /**
   * Creates the leaf hash for a commitment-amount pair
   * Uses keccak256(abi.encodePacked(commitment, amount)) for consistency with contracts
   *
   * @param commitment - The commitment hash
   * @param amount - The bet amount in wei
   * @returns The leaf hash
   */
  createLeafHash(commitment: string, amount: string): string;

  /**
   * Gets tree statistics for debugging/monitoring
   *
   * @param commitmentAmountPairs - The data to analyze
   * @returns Tree statistics
   */
  getTreeStats(commitmentAmountPairs: Array<[string, string]>): {
    leafCount: number;
    treeHeight: number;
    totalAmount: string;
  };
}