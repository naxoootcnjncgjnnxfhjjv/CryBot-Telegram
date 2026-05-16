import { getEvmNativeBalance } from '../chains/evm.js';
import { getTonBalance } from '../chains/ton.js';

export async function scanBalances(config) {
  const results = [];

  for (const address of config.wallets.evm) {
    try {
      results.push(await getEvmNativeBalance({ address, rpcUrl: config.rpcUrl }));
    } catch (error) {
      results.push({ chain: 'EVM', address, error: error.message });
    }
  }

  for (const address of config.wallets.ton) {
    try {
      results.push(await getTonBalance({ address, apiKey: config.tonApiKey }));
    } catch (error) {
      results.push({ chain: 'TON', address, error: error.message });
    }
  }

  for (const address of config.wallets.aptos) {
    results.push({ chain: 'APTOS', address, status: 'configured', note: 'Aptos balance scanner pending' });
  }

  return results;
}
