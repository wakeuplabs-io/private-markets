// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITreasury {
    event Deposited(uint256 indexed marketId, address indexed from, uint256 amount);
    event PayoutTransferred(uint256 indexed marketId, address indexed recipient, uint256 amount);

    function deposit(uint256 marketId, address from, uint256 amount) external;
    function transferPayout(uint256 marketId, address recipient, uint256 amount) external;

    // View functions
    function marketDeposits(uint256 marketId) external view returns (uint256);
    function marketPaidOut(uint256 marketId) external view returns (uint256);
    function getAvailableBalance(uint256 marketId) external view returns (uint256);
}