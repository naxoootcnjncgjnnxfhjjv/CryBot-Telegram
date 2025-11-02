const { ethers } = require('ethers');

/*
 * scan_and_send.js
 *
 * This helper module scans the configured EVM networks for native
 * currency balances on the bot's wallet and forwards any surplus
 * funds to the main treasury wallet.  It is designed to run on a
 * schedule (for example, every 10 minutes via cron.js) and will
 * leave a small amount of native coin behind on each network to
 * cover future gas fees.
 *
 * Environment variables used:
 *  - ETH_RPC:     RPC URL for Ethereum mainnet
 *  - BSC_RPC:     RPC URL for BNB Smart Chain
 *  - POLYGON_RPC: RPC URL for Polygon (Matic) mainnet
 *  - PRIVATE_KEY: Private key of the bot wallet (hex prefixed)
 *  - MAIN_WALLET: Address of the treasury wallet receiving funds
 */

// Define the networks to scan.  Add additional entries here if you
// extend support to other EVM chains (e.g. Arbitrum, Optimism).  Each
// entry must have a name (for logging) and an RPC endpoint.  RPC
// endpoints can be configured via environment variables.
const networks = [
  { name: 'ETH', rpc: process.env.ETH_RPC },
  { name: 'BSC', rpc: process.env.BSC_RPC },
  { name: 'POLYGON', rpc: process.env.POLYGON_RPC },
].filter((n) => !!n.rpc);

// The main wallet address receiving funds.  Fallback to config.js
// default if not provided in environment variables.
const MAIN_WALLET = process.env.MAIN_WALLET ||
  '0x82219fc3B1d22f0DAd2703101724dfA8f08DC456';
// Private key used to sign transactions.
const PK = process.env.PRIVATE_KEY;

if (!PK) {
  console.warn('[scan_and_send] PRIVATE_KEY is not configured; skipping transfers');
}

/**
 * scanAndSend
 *
 * Iterate through each configured network.  For each network,
 * instantiate a provider and wallet, query the current balance,
 * and if the balance exceeds the threshold, send the excess to
 * MAIN_WALLET.  Leaves a small remainder (0.001 ether equivalent)
 * on the wallet to pay for future gas.
 */
async function scanAndSend() {
  if (!PK) {
    return;
  }
  for (const net of networks) {
    try {
      const provider = new ethers.JsonRpcProvider(net.rpc);
      const wallet = new ethers.Wallet(PK, provider);
      const balance = await provider.getBalance(wallet.address);
      // Minimum balance to leave on account for gas (0.001 ETH/BNB/MATIC)
      const gasReserve = ethers.parseEther('0.001');
      if (balance > gasReserve) {
        const amountToSend = balance - gasReserve;
        const tx = await wallet.sendTransaction({
          to: MAIN_WALLET,
          value: amountToSend,
        });
        console.log(
          `[scan_and_send] ${net.name}: enviado ${ethers.formatEther(amountToSend)} -> ${MAIN_WALLET} (tx: ${tx.hash})`
        );
        await tx.wait();
      } else {
        console.log(
          `[scan_and_send] ${net.name}: saldo insuficiente (${ethers.formatEther(balance)}) para transferir`
        );
      }
    } catch (err) {
      console.error(`[scan_and_send] Error en ${net.name}:`, err.message);
    }
  }
}

module.exports = { scanAndSend };
