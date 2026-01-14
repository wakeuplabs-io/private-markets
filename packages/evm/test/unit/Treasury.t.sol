// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Treasury} from "../../src/Treasury.sol";
import {MockERC20} from "../../src/MockERC20.sol";

contract TreasuryTest is Test {
    Treasury public treasury;
    MockERC20 public usdc;

    address public owner = makeAddr("owner");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    uint256 constant MARKET_1 = 1;
    uint256 constant MARKET_2 = 2;

    event Deposited(uint256 indexed marketId, address indexed from, uint256 amount);
    event PayoutTransferred(uint256 indexed marketId, address indexed recipient, uint256 amount);

    function setUp() public {
        // Deploy MockERC20 with 18 decimals
        usdc = new MockERC20("Mock Token", "MTK", 18, 0);

        // Deploy Treasury
        vm.prank(owner);
        treasury = new Treasury(address(usdc));

        // Mint tokens to users
        usdc.mint(user1, 10_000 * 10**18); // 10k USDC
        usdc.mint(user2, 10_000 * 10**18); // 10k USDC
    }

    // ============================================
    // Constructor Tests - 2 tests
    // ============================================

    function test_constructor_initializesWithValidUSDC() public view {
        assertEq(address(treasury.COLLATERAL_TOKEN()), address(usdc));
        assertEq(treasury.owner(), owner);
    }

    function test_constructor_revertsWithZeroAddress() public {
        vm.expectRevert(Treasury.ZeroAddress.selector);
        new Treasury(address(0));
    }

    // ============================================
    // Deposit Tests - 6 tests
    // ============================================

    function test_deposit_transfersUSDCCorrectly() public {
        uint256 amount = 1000 * 10**18; // 1000 USDC

        // User1 approves Treasury
        vm.prank(user1);
        usdc.approve(address(treasury), amount);

        // Owner calls deposit
        vm.prank(owner);
        treasury.deposit(MARKET_1, user1, amount);

        // Verify balances
        assertEq(usdc.balanceOf(address(treasury)), amount);
        assertEq(usdc.balanceOf(user1), 9_000 * 10**18);
    }

    function test_deposit_incrementsMarketDepositsMapping() public {
        uint256 amount = 1000 * 10**18;

        vm.prank(user1);
        usdc.approve(address(treasury), amount);

        vm.prank(owner);
        treasury.deposit(MARKET_1, user1, amount);

        assertEq(treasury.marketDeposits(MARKET_1), amount);
        assertEq(treasury.getAvailableBalance(MARKET_1), amount);
    }

    function test_deposit_emitsDepositedEvent() public {
        uint256 amount = 500 * 10**18;

        vm.prank(user1);
        usdc.approve(address(treasury), amount);

        vm.expectEmit(true, true, true, true);
        emit Deposited(MARKET_1, user1, amount);

        vm.prank(owner);
        treasury.deposit(MARKET_1, user1, amount);
    }

    function test_deposit_revertsWhenNotOwner() public {
        uint256 amount = 100 * 10**18;

        vm.prank(user1);
        usdc.approve(address(treasury), amount);

        vm.prank(user2); // Not owner
        vm.expectRevert();
        treasury.deposit(MARKET_1, user1, amount);
    }

    function test_deposit_revertsWithZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(Treasury.ZeroAmount.selector);
        treasury.deposit(MARKET_1, user1, 0);
    }

    function test_deposit_revertsWithZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(Treasury.ZeroAddress.selector);
        treasury.deposit(MARKET_1, address(0), 1000 * 10**18);
    }

    // ============================================
    // TransferPayout Tests - 8 tests
    // ============================================

    function test_transferPayout_transfersUSDCToRecipient() public {
        // Setup: deposit USDC first
        uint256 depositAmount = 2000 * 10**18;
        vm.prank(user1);
        usdc.approve(address(treasury), depositAmount);
        vm.prank(owner);
        treasury.deposit(MARKET_1, user1, depositAmount);

        // Transfer payout
        uint256 payoutAmount = 500 * 10**18;
        uint256 user2BalanceBefore = usdc.balanceOf(user2);

        vm.prank(owner);
        treasury.transferPayout(MARKET_1, user2, payoutAmount);

        // Verify balances
        assertEq(usdc.balanceOf(user2), user2BalanceBefore + payoutAmount);
        assertEq(usdc.balanceOf(address(treasury)), depositAmount - payoutAmount);
    }

    function test_transferPayout_updatesMarketPaidOut() public {
        // Setup: deposit USDC first
        uint256 depositAmount = 2000 * 10**18;
        vm.prank(user1);
        usdc.approve(address(treasury), depositAmount);
        vm.prank(owner);
        treasury.deposit(MARKET_1, user1, depositAmount);

        // Transfer payout
        uint256 payoutAmount = 500 * 10**18;
        vm.prank(owner);
        treasury.transferPayout(MARKET_1, user2, payoutAmount);

        // Verify tracking
        assertEq(treasury.marketPaidOut(MARKET_1), payoutAmount);
        assertEq(treasury.getAvailableBalance(MARKET_1), depositAmount - payoutAmount);
    }

    function test_transferPayout_emitsPayoutTransferredEvent() public {
        // Setup: deposit USDC first
        uint256 depositAmount = 1000 * 10**18;
        vm.prank(user1);
        usdc.approve(address(treasury), depositAmount);
        vm.prank(owner);
        treasury.deposit(MARKET_1, user1, depositAmount);

        // Expect event
        uint256 payoutAmount = 300 * 10**18;
        vm.expectEmit(true, true, true, true);
        emit PayoutTransferred(MARKET_1, user2, payoutAmount);

        vm.prank(owner);
        treasury.transferPayout(MARKET_1, user2, payoutAmount);
    }

    function test_transferPayout_revertsWithInsufficientMarketBalance() public {
        // Deposit 1000 to MARKET_1
        uint256 depositAmount = 1000 * 10**18;
        vm.prank(user1);
        usdc.approve(address(treasury), depositAmount);
        vm.prank(owner);
        treasury.deposit(MARKET_1, user1, depositAmount);

        // Try to payout 1500 (more than deposited)
        uint256 payoutAmount = 1500 * 10**18;

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                Treasury.InsufficientMarketBalance.selector,
                MARKET_1,
                payoutAmount,
                depositAmount
            )
        );
        treasury.transferPayout(MARKET_1, user2, payoutAmount);
    }

    function test_transferPayout_preventsPayoutFromWrongMarket() public {
        // Deposit 1000 to MARKET_1
        vm.prank(user1);
        usdc.approve(address(treasury), 1000 * 10**18);
        vm.prank(owner);
        treasury.deposit(MARKET_1, user1, 1000 * 10**18);

        // Try to payout from MARKET_2 (no deposit)
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                Treasury.InsufficientMarketBalance.selector,
                MARKET_2,
                500 * 10**18,
                0
            )
        );
        treasury.transferPayout(MARKET_2, user2, 500 * 10**18);
    }

    function test_transferPayout_revertsWhenNotOwner() public {
        // Setup: deposit USDC first
        uint256 depositAmount = 1000 * 10**18;
        vm.prank(user1);
        usdc.approve(address(treasury), depositAmount);
        vm.prank(owner);
        treasury.deposit(MARKET_1, user1, depositAmount);

        // Try transfer as non-owner
        vm.prank(user2);
        vm.expectRevert();
        treasury.transferPayout(MARKET_1, user2, 500 * 10**18);
    }

    function test_transferPayout_revertsWithZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(Treasury.ZeroAmount.selector);
        treasury.transferPayout(MARKET_1, user2, 0);
    }

    function test_transferPayout_revertsWithZeroAddress() public {
        // Setup: deposit USDC first
        uint256 depositAmount = 1000 * 10**18;
        vm.prank(user1);
        usdc.approve(address(treasury), depositAmount);
        vm.prank(owner);
        treasury.deposit(MARKET_1, user1, depositAmount);

        // Try transfer to zero address
        vm.prank(owner);
        vm.expectRevert(Treasury.ZeroAddress.selector);
        treasury.transferPayout(MARKET_1, address(0), 500 * 10**18);
    }

    // ============================================
    // Per-Market Isolation Tests - 2 tests
    // ============================================

    function test_multipleMarkets_trackSeparately() public {
        // Deposit to MARKET_1
        vm.prank(user1);
        usdc.approve(address(treasury), 1000 * 10**18);
        vm.prank(owner);
        treasury.deposit(MARKET_1, user1, 1000 * 10**18);

        // Deposit to MARKET_2
        vm.prank(user2);
        usdc.approve(address(treasury), 2000 * 10**18);
        vm.prank(owner);
        treasury.deposit(MARKET_2, user2, 2000 * 10**18);

        // Verify separate tracking
        assertEq(treasury.marketDeposits(MARKET_1), 1000 * 10**18);
        assertEq(treasury.marketDeposits(MARKET_2), 2000 * 10**18);
        assertEq(treasury.getAvailableBalance(MARKET_1), 1000 * 10**18);
        assertEq(treasury.getAvailableBalance(MARKET_2), 2000 * 10**18);
    }

    function test_multipleMarkets_payoutDoesNotAffectOtherMarket() public {
        // Deposit to both markets
        vm.prank(user1);
        usdc.approve(address(treasury), 1000 * 10**18);
        vm.prank(owner);
        treasury.deposit(MARKET_1, user1, 1000 * 10**18);

        vm.prank(user2);
        usdc.approve(address(treasury), 2000 * 10**18);
        vm.prank(owner);
        treasury.deposit(MARKET_2, user2, 2000 * 10**18);

        // Payout from MARKET_1
        vm.prank(owner);
        treasury.transferPayout(MARKET_1, user2, 500 * 10**18);

        // Verify MARKET_1 affected, MARKET_2 not
        assertEq(treasury.marketPaidOut(MARKET_1), 500 * 10**18);
        assertEq(treasury.marketPaidOut(MARKET_2), 0);
        assertEq(treasury.getAvailableBalance(MARKET_1), 500 * 10**18);
        assertEq(treasury.getAvailableBalance(MARKET_2), 2000 * 10**18);
    }
}
