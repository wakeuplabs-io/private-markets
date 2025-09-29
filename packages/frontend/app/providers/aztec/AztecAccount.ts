import type { AccountWallet } from "@aztec/aztec.js";
import type { IWalletAccount } from "@/types/wallet";

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