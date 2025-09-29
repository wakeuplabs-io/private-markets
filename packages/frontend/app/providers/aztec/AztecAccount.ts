import type { IWalletAccount } from "@/types/wallet";
import type { AccountWallet } from '@aztec/aztec.js';

export class AztecAccount implements IWalletAccount {
  constructor(private accountWallet: AccountWallet) {}

  getAddress(): { toString(): string } {
    return this.accountWallet.getAddress();
  }

  getAccountWallet(): AccountWallet {
    return this.accountWallet;
  }

  toString(): string {
    return this.accountWallet.getAddress().toString();
  }
}