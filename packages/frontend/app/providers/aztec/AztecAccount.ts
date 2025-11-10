import type { IWalletAccount } from "@/types/wallet";
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { AztecAddress } from '@aztec/stdlib/aztec-address';

export class AztecAccount implements IWalletAccount {
  constructor(
    private accountWallet: Wallet,
    private address: AztecAddress
  ) {}

  getAddress(): AztecAddress {
    return this.address;
  }

  getAccountWallet(): Wallet {
    return this.accountWallet;
  }

  toString(): string {
    return this.address.toString();
  }
}