// Market types
export type {
  MarketStatus,
  MarketOption,
  Market,
  MarketSummary,
  CreateMarketData,
  AdminMarket,
  CreateMarketFormData,
  AdminMarketFilters,
  MarketResolutionData,
  BlockchainConnectionStatus,
  MarketOptionWithOdds,
  ContractMarket,
  AdminMarketData,
  MarketStats,
} from './market'

// Betting types
export type {
  BetStatus,
  Bet,
  PlaceBetData,
  BetConfirmation,
  ClaimReward,
  UserBet,
  UserActivityData,
} from './betting'

// Wallet types
export type {
  WalletConnectionStatus,
  WalletType,
  WalletInfo,
  WalletState,
  ConnectWalletOptions,
  IWalletAccount,
  IWalletProvider,
  IExtendedWalletProvider,
  WalletConnector,
} from './wallet'

// Aztec wallet types
export type {
  AztecWalletConfig,
  AztecAccountData,
  AztecContractParams,
  AztecTransactionInteraction,
  TestAccountOptions,
  CreateAccountOptions,
} from '@/providers/aztec/types'

export type {
  CreateMarketStep,
  CreateMarketFlow,
  AdminUser,
  AdminDashboardStats,
  ModalState,
  AdminModalStates,
  CreateMarketResponse,
  ResolveMarketResponse,
} from './admin'