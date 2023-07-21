// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ExternalBridge is Ownable {
    using SafeERC20 for IERC20;

    mapping(address => uint256) public depositFees;
    mapping(bytes32 => bool) public processedWithdrawals;

    event DepositFeeUpdated(
        address indexed token,
        uint256 oldValue,
        uint256 newValue
    );
    event DepositStarted(
        address indexed token,
        address indexed sender,
        address indexed receiver,
        uint256 amount
    );
    event WithdrawalEnded(
        address indexed token,
        address indexed receiver,
        uint256 amount,
        bytes32 originTxHash
    );

    /**
     * @dev Function used for start deposit. Emits event for offchain service.
     * @param token Address of token to deposit.
     * @param amount Amount of funds to deposit.
     * @param receiver Address in Siberium network for funds.
     */
    function startDeposit(
        address token,
        uint256 amount,
        address receiver
    ) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 fee = depositFees[token];
        if (fee > 0) {
            uint256 feeAmount = (amount * fee) / 1e4;
            IERC20(token).safeTransfer(owner(), feeAmount);
            amount -= feeAmount;
        }
        emit DepositStarted(token, msg.sender, receiver, amount);
    }

    /**
     * @dev Function used by offchain service after user started withdrawal from Siberium.
     * @param token Address of token to withdraw.
     * @param amount Amount of funds to withdraw.
     * @param receiver Address to withdraw funds to.
     * @param originTxHash Transaction hash from external network that triggered this withdrawal.
     */
    function endWithdrawal(
        address token,
        uint256 amount,
        address receiver,
        bytes32 originTxHash
    ) external onlyOwner {
        require(!processedWithdrawals[originTxHash], "Withdrawal already done");
        processedWithdrawals[originTxHash] = true;

        IERC20(token).safeTransfer(receiver, amount);
        emit WithdrawalEnded(token, receiver, amount, originTxHash);
    }

    /**
     * @dev Change deposit fee. Fee using for cover transaction costs for mint transaction in siberium chain.
     * @param token Address of token to burn.
     * @param newFee New fee. Should be in bps (eg 1% fee = 100).
     */
    function changeDepositFee(
        address token,
        uint256 newFee
    ) external onlyOwner {
        require(newFee <= 1e4, "Fee cannot be greater than 100%");

        uint256 oldFee = depositFees[token];
        depositFees[token] = newFee;

        emit DepositFeeUpdated(token, oldFee, newFee);
    }
}
