// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import {SiberiumBridgedToken} from "./SiberiumBridgedToken.sol";

contract SiberiumBridge is Ownable {
    mapping(address => uint256) public withdrawalFees;

    event WithdrawalFeeUpdated(
        address indexed token,
        uint256 oldValue,
        uint256 newValue
    );
    event DepositEnded(
        address indexed token,
        address indexed receiver,
        uint256 amount,
        bytes32 originTxId
    );
    event WithdrawalStarted(
        address indexed token,
        address indexed sender,
        address indexed receiver,
        uint256 amount
    );

    /**
     * @dev Mint function used by offchain service after user started deposit from another chain.
     * @param token Address of token to mint.
     * @param amount Amount of funds to mint.
     * @param receiver Address to mint funds to.
     * @param originTxId Transaction ID from external network that triggered this minting.
     */
    function endDeposit(
        address token,
        uint256 amount,
        address receiver,
        bytes32 originTxId
    ) external onlyOwner {
        SiberiumBridgedToken(token).mint(receiver, amount);
        emit DepositEnded(token, receiver, amount, originTxId);
    }

    /**
     * @dev Burn function used for start withdrawal. Emits event for offchain service.
     * @param token Address of token to burn.
     * @param amount Amount of funds to burn.
     * @param receiver Address in external network for funds.
     */
    function startWithdrawal(
        address token,
        uint256 amount,
        address receiver
    ) external {
        SiberiumBridgedToken(token).burn(msg.sender, amount);

        uint256 fee = withdrawalFees[token];
        if (fee > 0) {
            uint256 feeAmount = (amount * fee) / 1e4;
            SiberiumBridgedToken(token).mint(owner(), feeAmount);
            amount -= feeAmount;
        }
        emit WithdrawalStarted(token, msg.sender, receiver, amount);
    }

    /**
     * @dev Change withdrawal fee. Fee using for cover transaction costs for withdrawal transaction in external network.
     * @param token Address of token to burn.
     * @param newFee New fee. Should be in bps (eg 1% fee = 100).
     */
    function changeWithdrawalFee(
        address token,
        uint256 newFee
    ) external onlyOwner {
        require(newFee <= 1e4, "Fee cannot be greater than 100%");

        uint256 oldFee = withdrawalFees[token];
        withdrawalFees[token] = newFee;

        emit WithdrawalFeeUpdated(token, oldFee, newFee);
    }
}
