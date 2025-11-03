export interface AccountKeys {
  privateKey: string;
  salt: string;
}

export interface AccountInfo {
  address: string;
  deployed: boolean;
}

export interface DeployedAccounts {
  [accountName: string]: AccountInfo;
}

export interface StoredKeys {
  [accountName: string]: AccountKeys;
}

export interface ContractAddresses {
  [contractName: string]: string;
}