/**
 * Contract configuration and addresses
 */

export const CONTRACT_ADDRESSES = {
  TOKEN: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS,
} as const;

export const NETWORK_CONFIG = {
  PXE_URL: process.env.NEXT_PUBLIC_PXE_URL || "http://localhost:8080",
} as const;

if (!CONTRACT_ADDRESSES.TOKEN) {
  console.warn("TOKEN contract address not configured in environment variables");
}
export type ContractAddresses = typeof CONTRACT_ADDRESSES;
export type NetworkConfig = typeof NETWORK_CONFIG;