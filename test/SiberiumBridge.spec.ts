import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("SiberiumBridge", function () {
  async function deployBridgeAndToken() {
    const [offchainService, user] = await ethers.getSigners();

    const SiberiumBridge = await ethers.getContractFactory("SiberiumBridge")
    const siberiumBridge = await SiberiumBridge.deploy();
    await siberiumBridge.waitForDeployment()
    await siberiumBridge.transferOwnership(offchainService.address)

    const SiberiumBridgedToken = await ethers.getContractFactory("SiberiumBridgedToken")
    const siberiumUsdt = await SiberiumBridgedToken.deploy("USDT.e", "Tether USD", 6)
    await siberiumUsdt.transferOwnership(await siberiumBridge.getAddress())

    return { offchainService, user, siberiumBridge, siberiumUsdt };
  }

  describe("Deposit", function () {
    it("Should mint tokens to user", async function () {
      const { offchainService, user, siberiumBridge, siberiumUsdt } = await loadFixture(deployBridgeAndToken);

      const depositAmount = ethers.parseUnits("100", 6);
      await siberiumBridge.connect(offchainService).endDeposit(
        await siberiumUsdt.getAddress(),
        depositAmount,
        user.address,
        ethers.encodeBytes32String("123")
      )
      expect(await siberiumUsdt.balanceOf(user.address)).to.be.eq(depositAmount);
    });
    it("Should revert already processed deposit (doublespend protection)", async function () {
      const { offchainService, user, siberiumBridge, siberiumUsdt } = await loadFixture(deployBridgeAndToken);

      const depositAmount = ethers.parseUnits("100", 6);
      const originTxHash = ethers.encodeBytes32String("123");

      await siberiumBridge.connect(offchainService).endDeposit(
        await siberiumUsdt.getAddress(),
        depositAmount,
        user.address,
        originTxHash
      )
      await expect(siberiumBridge.connect(offchainService).endDeposit(
        await siberiumUsdt.getAddress(),
        depositAmount,
        user.address,
        originTxHash
      )).to.be.reverted
    })
  });

  describe("Withdrawal", function () {
    it("Should burn tokens and emit event for offchain service", async function () {
      const { offchainService, user, siberiumBridge, siberiumUsdt } = await loadFixture(deployBridgeAndToken);

      const withdrawAmount = ethers.parseUnits("100", 6);

      // user should have tokens, so we deposit it first
      await siberiumBridge.connect(offchainService).endDeposit(
        await siberiumUsdt.getAddress(),
        withdrawAmount,
        user.address,
        ethers.encodeBytes32String("123")
      )

      const tx = await siberiumBridge.connect(user).startWithdrawal(
        await siberiumUsdt.getAddress(),
        withdrawAmount,
        user.address
      )

      expect(await siberiumUsdt.balanceOf(user.address)).to.be.eq(0);
      await expect(tx).to.emit(siberiumBridge, "WithdrawalStarted").withArgs(
        await siberiumUsdt.getAddress(),
        user.address,
        user.address,
        withdrawAmount
      )
    });

    it("Should take withdraw fee", async function () {
      const fee = 100; // 1%
      const withdrawAmount = ethers.parseUnits("100", 6);

      // we need to set withdrawal fees (by default it is 0%)
      const { offchainService, user, siberiumBridge, siberiumUsdt } = await loadFixture(deployBridgeAndToken);
      await siberiumBridge.connect(offchainService).changeWithdrawalFee(
        await siberiumUsdt.getAddress(),
        fee
      )

      // user should have tokens, so we deposit it first
      await siberiumBridge.connect(offchainService).endDeposit(
        await siberiumUsdt.getAddress(),
        withdrawAmount,
        user.address,
        ethers.encodeBytes32String("123")
      )

      const tx = await siberiumBridge.connect(user).startWithdrawal(
        await siberiumUsdt.getAddress(),
        withdrawAmount,
        user.address
      )

      expect(await siberiumUsdt.balanceOf(user.address)).to.be.eq(0);
      expect(await siberiumUsdt.balanceOf(offchainService.address)).to.be.eq(
        withdrawAmount * ethers.toBigInt(fee) / ethers.toBigInt(1e4)
      )
      await expect(tx).to.emit(siberiumBridge, "WithdrawalStarted").withArgs(
        await siberiumUsdt.getAddress(),
        user.address,
        user.address,
        withdrawAmount - withdrawAmount * ethers.toBigInt(fee) / ethers.toBigInt(1e4)
      )
    });
  });

  describe("ACL", async function () {
    it("Should revert on protected functions", async function () {
      const { user, siberiumBridge, siberiumUsdt } = await loadFixture(deployBridgeAndToken);

      await expect(siberiumBridge.connect(user).endDeposit(
        await siberiumUsdt.getAddress(),
        123,
        user.address,
        ethers.encodeBytes32String("123")
      )).to.be.reverted

      await expect(siberiumBridge.connect(user).changeWithdrawalFee(
        await siberiumUsdt.getAddress(),
        1
      )).to.be.reverted
    })
  })
});
