// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITreasury {
    function mint(address to, uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}