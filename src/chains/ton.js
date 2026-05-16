import fetch from 'node-fetch';

export async function getTonBalance({ address, apiKey }) {
  if (!address) {
    throw new Error('Missing TON address');
  }

  const headers = {};

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`https://tonapi.io/v2/accounts/${address}`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`TON API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    chain: 'TON',
    address,
    balance: Number(data.balance || 0) / 1e9,
    symbol: 'TON'
  };
}
