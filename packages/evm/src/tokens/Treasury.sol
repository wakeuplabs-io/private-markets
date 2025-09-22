// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ITreasury} from "../interfaces/ITreasury.sol";

/**
 * @title Treasury
 * @dev ERC20 Treasury contract for the prediction market system
 * Handles minting tokens when bets are received and transferring payouts to winners
 */
contract Treasury is ERC20, Ownable, ITreasury {
    // Custom Errors
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientTreasuryBalance(uint256 requested, uint256 available);
    error UnauthorizedTreasuryTransfer(address caller, address owner);
    /**
     * @dev Event emitted when tokens are minted for a bet
     * @param amount The amount of tokens minted
     */
    event TokensMinted(uint256 amount);

    /**
     * @dev Event emitted when a payout is transferred
     * @param to The recipient address
     * @param amount The payout amount
     */
    event PayoutTransferred(address indexed to, uint256 amount);

    /**
     * @dev Constructor to initialize the Treasury token
     * @param name_ Token name (e.g., "Prediction Market Token")
     * @param symbol_ Token symbol (e.g., "PMT")
     * @param initialSupply Initial token supply (can be 0 for mint-on-demand model)
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    /**
     * @notice Mint new tokens (only owner/PredictionMarketCore)
     * @param to Address to receive the tokens
     * @param amount Amount to mint (in wei units)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _mint(to, amount);
        emit TokensMinted(amount);
    }

    /**
     * @notice Transfer tokens for payout (only owner/PredictionMarketCore)
     * @param to Address to receive the tokens
     * @param amount Amount to transfer (in wei units)
     * @return bool True if transfer succeeded
     */
    function transfer(address to, uint256 amount) public override(ERC20, ITreasury) onlyOwner returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 currentBalance = balanceOf(address(this));
        if (currentBalance < amount) revert InsufficientTreasuryBalance(amount, currentBalance);

        _transfer(address(this), to, amount);
        emit PayoutTransferred(to, amount);
        return true;
    }

    /**
     * @notice Get the treasury's token balance
     * @return uint256 The treasury's current token balance
     */
    function treasuryBalance() external view returns (uint256) {
        return balanceOf(address(this));
    }

    /**
     * @notice Get balance of any account (override from both ERC20 and ITreasury)
     * @param account Address to check balance for
     * @return uint256 The account's token balance
     */
    function balanceOf(address account) public view override(ERC20, ITreasury) returns (uint256) {
        return super.balanceOf(account);
    }

    /**
     * @notice Emergency withdrawal function (only owner)
     * @dev Should only be used in emergency situations
     * @param to Address to receive the tokens
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 currentBalance = balanceOf(address(this));
        if (currentBalance < amount) revert InsufficientTreasuryBalance(amount, currentBalance);

        _transfer(address(this), to, amount);
    }

    /**
     * @dev Override transferFrom to prevent unauthorized transfers from treasury
     */
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        // Only allow transfers if not from the treasury address, or if called by owner
        if (from == address(this)) {
            if (msg.sender != owner()) revert UnauthorizedTreasuryTransfer(msg.sender, owner());
        }
        return super.transferFrom(from, to, amount);
    }
}