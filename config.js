import * as dotenv from 'dotenv';
dotenv.config();

export function loadConfig() {
  return {
    botToken: process.env.BOT_TOKEN,
    rpcUrl: process.env.RPC_URL || "https://eth.llamarpc.com",
    privateKey: process.env.PRIVATE_KEY,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    tonApiKey: process.env.TON_API_KEY,
    port: process.env.PORT || 3000,
  };
}