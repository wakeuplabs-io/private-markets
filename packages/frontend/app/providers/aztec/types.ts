import type {
  AztecAddress,
  Fr,
  ContractArtifact,
  ContractFunctionInteraction
} from "@aztec/aztec.js";

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