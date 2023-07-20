import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 99999999,
      },
    },
  },
  networks: {
    goerli: {
      url: "https://goerli.blockpi.network/v1/rpc/public",
      chainId: 5,
      accounts: [process.env.OFFCHAIN_SERVICE!]
    },
    siberiumTest: {
      url: "https://rpc.test.siberium.net",
      chainId: 111000,
      accounts: [process.env.OFFCHAIN_SERVICE!]
    }
  },
  etherscan: {
    apiKey: {
      goerli: process.env.ETHERSCAN_API_KEY!
    }
  }
};

export default config;
