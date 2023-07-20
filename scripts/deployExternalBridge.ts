import { ethers, network } from "hardhat";


async function main() {
    const ExternalBridge = await ethers.getContractFactory("ExternalBridge")
    const externalBridge = await ExternalBridge.deploy();
    await externalBridge.waitForDeployment();

    console.log(`External bridge for chain #${network.config.chainId} deployed`);
    console.log(await externalBridge.getAddress());
    console.log("");
    console.log("Commands for verifications:");
    console.log(`npx hardhat --network ${network.name} verify ${await externalBridge.getAddress()}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
