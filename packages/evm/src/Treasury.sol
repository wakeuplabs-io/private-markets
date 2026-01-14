// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";

/**
 * @title Treasury
 * @notice Treasury for USDC custody in prediction markets
 * @dev Uses external USDC token (no internal minting)
 * @dev Implements per-market tracking to prevent over-distribution
 * @dev Follows Checks-Effects-Interactions pattern for security
 */
contract Treasury is Ownable, ITreasury, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Custom Errors
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientMarketBalance(uint256 marketId, uint256 requested, uint256 available);
    error InsufficientContractBalance(uint256 requested, uint256 available);

    // Immutable token reference
    IERC20 public immutable COLLATERAL_TOKEN;

    // Per-market accounting
    mapping(uint256 => uint256) public marketDeposits;  // Total deposited per market
    mapping(uint256 => uint256) public marketPaidOut;   // Total paid out per market

    /**
     * @dev Constructor initializes with collateral token (USDC)
     * @param _collateralToken Address of the USDC token contract
     */
    constructor(address _collateralToken) Ownable(msg.sender) {
        if (_collateralToken == address(0)) revert ZeroAddress();
        COLLATERAL_TOKEN = IERC20(_collateralToken);
    }

    /**
     * @notice Deposit collateral for a specific market
     * @dev Follows CEI pattern: Checks → Effects → Interactions
     * @dev Only callable by owner (PredictionMarketCore)
     * @param marketId The market ID to deposit for
     * @param from The address providing the collateral
     * @param amount The amount of USDC to deposit
     */
    function deposit(uint256 marketId, address from, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();
        if (from == address(0)) revert ZeroAddress();

        marketDeposits[marketId] += amount;
        COLLATERAL_TOKEN.safeTransferFrom(from, address(this), amount);
        emit Deposited(marketId, from, amount);
    }

    /**
     * @notice Transfer payout to a claim winner
     * @dev Follows CEI pattern: Checks → Effects → Interactions
     * @dev Validates market has sufficient balance before transferring
     * @dev Only callable by owner (PredictionMarketCore)
     * @param marketId The market ID to pay from
     * @param recipient The address receiving the payout
     * @param amount The amount of USDC to transfer
     */
    function transferPayout(uint256 marketId, address recipient, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();

        uint256 deposited = marketDeposits[marketId];
        uint256 paidOut = marketPaidOut[marketId];
        uint256 availableForMarket = deposited - paidOut;

        if (availableForMarket < amount) {
            revert InsufficientMarketBalance(marketId, amount, availableForMarket);
        }

        uint256 contractBalance = COLLATERAL_TOKEN.balanceOf(address(this));
        if (contractBalance < amount) {
            revert InsufficientContractBalance(amount, contractBalance);
        }

        marketPaidOut[marketId] += amount;
        COLLATERAL_TOKEN.safeTransfer(recipient, amount);
        emit PayoutTransferred(marketId, recipient, amount);
    }

    /**
     * @notice Get available balance for a specific market
     * @param marketId The market ID to query
     * @return The amount of USDC available for payouts in this market
     */
    function getAvailableBalance(uint256 marketId) external view returns (uint256) {
        uint256 deposited = marketDeposits[marketId];
        uint256 paidOut = marketPaidOut[marketId];
        return deposited - paidOut;
    }
}
