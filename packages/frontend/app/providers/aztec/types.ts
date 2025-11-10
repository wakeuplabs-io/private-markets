import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { Fr } from "@aztec/foundation/fields";
import type { ContractArtifact } from "@aztec/aztec.js/abi";
import type { ContractFunctionInteraction } from "@aztec/aztec.js/contracts";

export interface AztecWalletConfig {
  nodeUrl?: string;
  proverEnabled?: boolean;
  accountType?: "ecdsa" | "schnorr";
}

export interface AztecAccountData {
  address: string;
  signingKey: string;
  secretKey: string;
  salt: string;
}

export interface AztecContractParams {
  artifact: ContractArtifact;
  deployer: AztecAddress;
  salt: Fr;
  constructorArgs: unknown[];
}

export type AztecTransactionInteraction = ContractFunctionInteraction;

export interface TestAccountOptions {
  index: number;
}

export interface CreateAccountOptions {
  accountType?: "ecdsa" | "schnorr";
  saveToStorage?: boolean;
}