// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IntegrationBase} from "./IntegrationBase.sol";

contract TreasuryTest is IntegrationBase {

    function test_mint_increasesUserBalanceAndTotalSupply() public {
        uint256 mintAmount = 1000 ether;
        uint256 balanceBefore = treasury.balanceOf(user1);

        vm.prank(address(predictionMarket));
        treasury.mint(user1, mintAmount);

        uint256 balanceAfter = treasury.balanceOf(user1);
        assertEq(balanceAfter - balanceBefore, mintAmount);

        assertEq(treasury.totalSupply(), mintAmount);
    }

    function test_mint_revertsWhenCallerIsNotOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        treasury.mint(user1, 1000 ether);
    }

    function test_mint_revertsWhenMintingToZeroAddress() public {
        vm.prank(address(predictionMarket));
        vm.expectRevert();
        treasury.mint(address(0), 1000 ether);
    }

    function test_mint_revertsWhenMintingZeroAmount() public {
        vm.prank(address(predictionMarket));
        vm.expectRevert();
        treasury.mint(user1, 0);
    }

    function test_transfer_movesTokensFromTreasuryToUser() public {
        uint256 amount = 1000 ether;
        vm.prank(address(predictionMarket));
        treasury.mint(address(treasury), amount);

        uint256 transferAmount = 500 ether;
        uint256 balanceBefore = treasury.balanceOf(user1);

        vm.prank(address(predictionMarket));
        bool success = treasury.transfer(user1, transferAmount);

        assertTrue(success);
        uint256 balanceAfter = treasury.balanceOf(user1);
        assertEq(balanceAfter - balanceBefore, transferAmount);

        assertEq(treasury.treasuryBalance(), amount - transferAmount);
    }

    function test_transfer_revertsWhenCallerIsNotOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        treasury.transfer(user1, 100 ether);
    }

    function test_transfer_revertsWhenTransferringToZeroAddress() public {
        vm.prank(address(predictionMarket));
        vm.expectRevert();
        treasury.transfer(address(0), 100 ether);
    }

    function test_transfer_revertsWhenTransferringZeroAmount() public {
        vm.prank(address(predictionMarket));
        vm.expectRevert();
        treasury.transfer(user1, 0);
    }

    function test_transfer_revertsWhenTreasuryHasInsufficientBalance() public {
        vm.prank(address(predictionMarket));
        vm.expectRevert();
        treasury.transfer(user1, 100 ether);
    }

    function test_emergencyWithdraw_transfersTokensFromTreasuryToRecipient() public {
        uint256 amount = 1000 ether;
        vm.prank(address(predictionMarket));
        treasury.mint(address(treasury), amount);

        uint256 withdrawAmount = 300 ether;
        uint256 balanceBefore = treasury.balanceOf(user1);

        vm.prank(address(predictionMarket));
        treasury.emergencyWithdraw(user1, withdrawAmount);

        uint256 balanceAfter = treasury.balanceOf(user1);
        assertEq(balanceAfter - balanceBefore, withdrawAmount);

        // Check treasury balance decreased
        assertEq(treasury.treasuryBalance(), amount - withdrawAmount);
    }

    function test_emergencyWithdraw_revertsWhenCallerIsNotOwner() public {
        vm.prank(user1); // Non-owner
        vm.expectRevert(); // Ownable: caller is not the owner
        treasury.emergencyWithdraw(user1, 100 ether);
    }

    function test_emergencyWithdraw_revertsWhenRecipientIsZeroAddress() public {
        vm.prank(address(predictionMarket));
        vm.expectRevert(); // ZeroAddress custom error
        treasury.emergencyWithdraw(address(0), 100 ether);
    }

    function test_emergencyWithdraw_revertsWhenTreasuryHasInsufficientBalance() public {
        vm.prank(address(predictionMarket));
        vm.expectRevert(); // InsufficientTreasuryBalance custom error
        treasury.emergencyWithdraw(user1, 100 ether);
    }

    function test_treasuryBalance_returnsCorrectAmountOfTokensInTreasury() public {
        assertEq(treasury.treasuryBalance(), 0);

        uint256 amount = 500 ether;
        vm.prank(address(predictionMarket));
        treasury.mint(address(treasury), amount);

        assertEq(treasury.treasuryBalance(), amount);
    }

    function test_balanceOf_returnsCorrectTokenBalanceForUser() public {
        uint256 amount = 200 ether;

        vm.prank(address(predictionMarket));
        treasury.mint(user1, amount);

        assertEq(treasury.balanceOf(user1), amount);
        assertEq(treasury.balanceOf(user2), 0);
    }

    function test_transferFrom_allowsOwnerToMoveTokensFromTreasuryButRejectsOthers() public {
        uint256 amount = 1000 ether;
        vm.prank(address(predictionMarket));
        treasury.mint(address(treasury), amount);

        vm.prank(user1);
        vm.expectRevert();
        treasury.transferFrom(address(treasury), user1, 100 ether);

        vm.prank(address(treasury));
        treasury.approve(address(predictionMarket), amount);

        vm.prank(address(predictionMarket));
        bool success = treasury.transferFrom(address(treasury), user1, 100 ether);
        assertTrue(success);

        assertEq(treasury.balanceOf(user1), 100 ether);
    }

    function test_transferFrom_allowsApprovedUserToTransferTokensBetweenAccounts() public {
        uint256 amount = 500 ether;
        vm.prank(address(predictionMarket));
        treasury.mint(user1, amount);

        vm.prank(user1);
        treasury.approve(user2, 100 ether);

        vm.prank(user2);
        bool success = treasury.transferFrom(user1, user2, 100 ether);
        assertTrue(success);

        assertEq(treasury.balanceOf(user1), 400 ether);
        assertEq(treasury.balanceOf(user2), 100 ether);
    }

    function test_treasuryIntegration_worksCorrectlyWithPredictionMarketClaimsFlow() public {
        uint256 amount = 1000 ether;

        vm.prank(address(predictionMarket));
        treasury.mint(address(treasury), amount);

        vm.prank(admin);
        uint256 marketId = predictionMarket.createMarket("Test market");

        vm.prank(address(wormholeReceiver));
        bytes32 betId = keccak256("bet1");
        predictionMarket.processBet(marketId, betId, true, 100 ether, testCommitment);

        assertGt(treasury.treasuryBalance(), amount);

        // NOTE: Simplified Merkle tree logic for testing Treasury fund delivery
        // The actual Merkle tree verification is handled off-chain by the builder service
        // This test focuses on Treasury's responsibility: delivering funds to valid claimants
        bytes32 leaf = keccak256(abi.encodePacked(testCommitment, uint256(50 ether)));
        bytes32 winnersRoot = leaf; // Single-leaf tree for simplicity

        vm.prank(admin);
        predictionMarket.setWinnersRoot(marketId, winnersRoot);

        uint256 treasuryBalanceBefore = treasury.treasuryBalance();
        bytes32[] memory proof = new bytes32[](0); // Empty proof for single-leaf tree

        // Test Treasury's core responsibility: transferring tokens when claim is valid
        vm.prank(user1);
        predictionMarket.claim(marketId, 50 ether, proof, testSecret, user1);

        assertEq(treasury.treasuryBalance(), treasuryBalanceBefore - 50 ether);
        assertEq(treasury.balanceOf(user1), 50 ether);
    }

    function test_erc20Functions_workCorrectlyForUserToUserTokenTransfers() public {
        uint256 amount = 1000 ether;

        assertEq(treasury.name(), "Prediction Market Token");
        assertEq(treasury.symbol(), "PMT");
        assertEq(treasury.decimals(), 18);

        vm.prank(address(predictionMarket));
        treasury.mint(user1, amount);

        assertEq(treasury.totalSupply(), amount);
        assertEq(treasury.balanceOf(user1), amount);

        vm.prank(user1);
        treasury.approve(user2, 300 ether);

        vm.prank(user2);
        bool success1 = treasury.transferFrom(user1, user2, 300 ether);
        assertTrue(success1);

        assertEq(treasury.balanceOf(user1), 700 ether);
        assertEq(treasury.balanceOf(user2), 300 ether);

        vm.prank(user1);
        treasury.approve(user2, 200 ether);

        assertEq(treasury.allowance(user1, user2), 200 ether);

        vm.prank(user2);
        bool success2 = treasury.transferFrom(user1, admin, 150 ether);
        assertTrue(success2);

        assertEq(treasury.balanceOf(user1), 550 ether);
        assertEq(treasury.balanceOf(admin), 150 ether);
        assertEq(treasury.allowance(user1, user2), 50 ether);
    }
}