/*
 * Updated EVM module
 *
 * This version of the module points at the Etherscan V2 API for balance
 * retrieval. The API v1 endpoints have been deprecated as of August 2025,
 * and will return a deprecation error. To use this module you must supply a
 * valid Etherscan API key via the environment variable ETHERSCAN_API_KEY.
 * See https://docs.etherscan.io/v2-migration for details.
 */

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const config = require('../config');

/**
 * Fetch native ETH balance for a single address via Etherscan V2 API.
 * @param {string} address
 */
async function fetchEthBalance(address) {
  if (!address) return '0';
  // Use the Etherscan V2 API base path. Chain ID 1 corresponds to Ethereum mainnet.
  const url =
    `https://api.etherscan.io/v2/api?module=account&action=balance&chainid=1&address=${address}&apikey=${config.ETHERSCAN_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === '1' && data.result) {
      return (parseFloat(data.result) / 1e18).toString();
    }
    // Fallback to zero on unexpected response
    return '0';
  } catch (err) {
    console.error('Error fetching ETH balance:', err);
    return '0';
  }
}

/**
 * Get balances for a list of EVM wallets. Returns an array of objects
 * with address and balance fields.
 */
async function getBalances(wallets = []) {
  const results = [];
  for (const address of wallets) {
    const balance = await fetchEthBalance(address);
    results.push({ address, balance });
  }
  return results;
}

/**
 * Fetch token balances for each wallet using Ethplorer. This function is
 * rate limited on the free plan; replace with your own service if
 * necessary.
 * @param {string[]} wallets
 */
async function getTokenBalances(wallets = []) {
  const results = [];
  for (const address of wallets) {
    const url = `https://api.ethplorer.io/getAddressInfo/${address}?apiKey=freekey`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const tokenBalances = [];
      if (data.tokens) {
        data.tokens.forEach(t => {
          const balance = (
            parseFloat(t.balance) / Math.pow(10, t.tokenInfo.decimals)
          ).toString();
          tokenBalances.push({ symbol: t.tokenInfo.symbol, balance });
        });
      }
      results.push({ address, tokenBalances });
    } catch (err) {
      console.error('Error fetching token balances:', err);
      results.push({ address, tokenBalances: [] });
    }
  }
  return results;
}

/**
 * Send a token to another address. This is a placeholder that returns
 * a fake transaction hash. Integrate with ethers.js for actual
 * functionality.
 */
async function sendToken(from, to, amount, symbol) {
  console.log(`Sending ${amount} ${symbol} from ${from} to ${to}…`);
  // TODO: use ethers.js to sign and send transactions
  return '0xdeadbeef';
}

/**
 * Placeholder for scanning wallets and selling tokens or NFTs. Extend
 * this function to call marketplace or DEX APIs.
 */
async function scanAndSell(wallets = []) {
  for (const address of wallets) {
    console.log(`[EVM] Escaneando ${address} para tokens y NFTs…`);
    // TODO: implement selling logic
  }
}

module.exports = {
  getBalances,
  getTokenBalances,
  sendToken,
  scanAndSell,
};
