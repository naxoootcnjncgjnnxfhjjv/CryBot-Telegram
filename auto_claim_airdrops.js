const { ethers } = require('ethers');

/*
 * auto_claim_airdrops.js
 *
 * Utility for claiming rewards or airdrops from arbitrary smart
 * contracts.  This module attempts to invoke a variety of common
 * claim/hunt functions on each contract supplied via the
 * AIRDROP_CONTRACTS environment variable.  When run, it loops
 * through the provided list of contract addresses and tries each
 * signature in order until one succeeds.  If no signature works the
 * contract is skipped.
 *
 * Environment variables used:
 *   - PRIVATE_KEY:    Private key of the wallet used to claim rewards.
 *   - ETH_RPC:        RPC URL for Ethereum or the relevant EVM chain.
 *   - AIRDROP_CONTRACTS: Comma-separated list of contract addresses to
 *                        claim from.
 */

// List of claim function signatures to try.  The list covers many
// common patterns used by yield farming and airdrop contracts.
const CLAIM_FUNCTIONS = [
  'claim()',
  'claim(address)',
  'harvest()',
  'getReward()',
  'withdraw()',
  'withdraw(uint256)',
  'exit()'
];

// Build the ABI needed to interact with the claim functions.
const CLAIM_ABI = CLAIM_FUNCTIONS.map((sig) => `function ${sig}`);

async function autoClaimAirdrops() {
  const pk = process.env.PRIVATE_KEY;
  const rpc = process.env.ETH_RPC || process.env.RPC_URL;
  const contractsRaw = process.env.AIRDROP_CONTRACTS || '';
  const contractList = contractsRaw
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  if (!pk || !rpc) {
    console.warn('[autoClaimAirdrops] PRIVATE_KEY or ETH_RPC not configured');
    return;
  }
  if (contractList.length === 0) {
    console.log('[autoClaimAirdrops] No contracts provided to claim');
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const results = [];

  for (const addr of contractList) {
    let claimed = false;
    try {
      const contract = new ethers.Contract(addr, CLAIM_ABI, wallet);
      for (const sig of CLAIM_FUNCTIONS) {
        const fnName = sig.split('(')[0];
        if (typeof contract[fnName] !== 'function') {
          continue;
        }
        try {
          let tx;
          if (sig === 'claim(address)') {
            tx = await contract.claim(wallet.address);
          } else if (sig === 'withdraw(uint256)') {
            tx = await contract.withdraw(0);
          } else {
            tx = await contract[fnName]();
          }
          console.log(`[autoClaimAirdrops] ${fnName} executed on ${addr}, tx: ${tx.hash}`);
          await tx.wait();
          results.push({ contract: addr, fn: fnName, tx: tx.hash });
          claimed = true;
          break;
        } catch (err) {
          continue;
        }
      }
      if (!claimed) {
        console.log(`[autoClaimAirdrops] No claim methods succeeded on ${addr}`);
        results.push({ contract: addr, error: 'No claim methods succeeded' });
      }
    } catch (err) {
      console.error(`[autoClaimAirdrops] Error interacting with ${addr}:`, err.message);
      results.push({ contract: addr, error: err.message });
    }
  }
  return results;
}

module.exports = { autoClaimAirdrops };
