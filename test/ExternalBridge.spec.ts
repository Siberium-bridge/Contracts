import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ExternalBridge", function () {
    async function deployBridgeAndToken() {
        const [offchainService, user] = await ethers.getSigners();

        const ExternalBridge = await ethers.getContractFactory("ExternalBridge")
        const externalBridge = await ExternalBridge.deploy();
        await externalBridge.waitForDeployment()
        await externalBridge.transferOwnership(offchainService.address)

        const SiberiumBridgedToken = await ethers.getContractFactory("SiberiumBridgedToken")
        const usdt = await SiberiumBridgedToken.deploy("USDT", "Tether USD", 6)

        await usdt.mint(user.address, ethers.parseUnits("1000", 6))

        return { offchainService, user, externalBridge, usdt };
    }

    describe("Deposit", function () {
        it("Should lock tokens and emit event for offchain service", async function () {
            const { user, externalBridge, usdt } = await loadFixture(deployBridgeAndToken);

            const balanceBefore = await usdt.balanceOf(user.address)
            const depositAmount = ethers.parseUnits("100", 6);
            await usdt.connect(user).approve(await externalBridge.getAddress(), ethers.MaxUint256)

            const tx = await externalBridge.connect(user).startDeposit(
                await usdt.getAddress(),
                depositAmount,
                user.address
            )

            expect(await usdt.balanceOf(user.address)).to.be.eq(balanceBefore - depositAmount);
            expect(await usdt.balanceOf(await externalBridge.getAddress())).to.be.eq(depositAmount);
            await expect(tx).to.emit(externalBridge, "DepositStarted").withArgs(
                await usdt.getAddress(),
                user.address,
                user.address,
                depositAmount
            )

        });

        it("Should take deposit fee", async function () {
            const { offchainService, user, externalBridge, usdt } = await loadFixture(deployBridgeAndToken);

            const fee = 100; // 1%
            const depositAmount = ethers.parseUnits("100", 6);
            const balanceBefore = await usdt.balanceOf(user.address)
            await usdt.connect(user).approve(await externalBridge.getAddress(), ethers.MaxUint256)

            // we need to set deposit fees (by default it is 0%)
            await externalBridge.connect(offchainService).changeDepositFee(
                await usdt.getAddress(),
                fee
            )

            const tx = await externalBridge.connect(user).startDeposit(
                await usdt.getAddress(),
                depositAmount,
                user.address
            )

            expect(await usdt.balanceOf(user.address)).to.be.eq(balanceBefore - depositAmount);
            expect(await usdt.balanceOf(await externalBridge.getAddress())).to.be.eq(
                depositAmount - depositAmount * ethers.toBigInt(fee) / ethers.toBigInt(1e4)
            );
            expect(await usdt.balanceOf(offchainService.address)).to.be.eq(depositAmount * ethers.toBigInt(fee) / ethers.toBigInt(1e4));

            await expect(tx).to.emit(externalBridge, "DepositStarted").withArgs(
                await usdt.getAddress(),
                user.address,
                user.address,
                depositAmount - depositAmount * ethers.toBigInt(fee) / ethers.toBigInt(1e4)
            )
        });
    });

    describe("Withdrawal", function () {
        it("Should send tokens to user", async function () {
            const { offchainService, user, externalBridge, usdt } = await loadFixture(deployBridgeAndToken);
            const withdrawAmount = ethers.parseUnits("100", 6);

            // bridge should have funds for withdrawal
            await usdt.connect(user).transfer(await externalBridge.getAddress(), withdrawAmount);

            const balanceBefore = await usdt.balanceOf(user.address)
            await externalBridge.connect(offchainService).endWithdrawal(
                await usdt.getAddress(),
                withdrawAmount,
                user.address,
                ethers.encodeBytes32String("123")
            )
            expect(await usdt.balanceOf(user.address)).to.be.eq(balanceBefore + withdrawAmount);
        });
    });


    describe("ACL", async function () {
        it("Should revert on protected functions", async function () {
            const { user, externalBridge, usdt } = await loadFixture(deployBridgeAndToken);

            await expect(externalBridge.connect(user).endWithdrawal(
                await usdt.getAddress(),
                123,
                user.address,
                ethers.encodeBytes32String("123")
            )).to.be.reverted

            await expect(externalBridge.connect(user).changeDepositFee(
                await usdt.getAddress(),
                1
            )).to.be.reverted
        })
    })
});
