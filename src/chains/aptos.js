import { fetchWithTimeout } from '../core/fetchWithTimeout.js';

export async function getAptosBalance({ address }) {
  if (!address) {
    throw new Error('Missing Aptos address');
  }

  const response = await fetchWithTimeout(
    `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${address}/resources`,
    {},
    10000
  );

  if (!response.ok) {
    throw new Error(`Aptos API error: ${response.status}`);
  }

  const resources = await response.json();
  const coinStore = resources.find((resource) => resource.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
  const rawBalance = coinStore?.data?.coin?.value || '0';

  return {
    chain: 'APTOS',
    address,
    balance: Number(rawBalance) / 1e8,
    symbol: 'APT'
  };
}
