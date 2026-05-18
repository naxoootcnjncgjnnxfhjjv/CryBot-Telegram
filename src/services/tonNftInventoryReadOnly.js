import { fetchWithTimeout } from '../core/fetchWithTimeout.js';

const TONAPI_BASE = process.env.TONAPI_BASE || 'https://tonapi.io';

function headers(apiKey) {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

function text(value = '') {
  return String(value || '').trim();
}

function classifyItem(item) {
  const collectionName = text(item.collection?.name);
  const trust = text(item.trust).toLowerCase();
  const isScam = item.is_scam === true;

  if (isScam || trust.includes('black')) {
    return {
      decision: 'IGNORE_RISK',
      riskLevel: 'HIGH',
      note: 'Flagged by indexer metadata.'
    };
  }

  if (['Telegram Usernames', 'TON DNS Domains', 'Getgems Domains'].includes(collectionName)) {
    return {
      decision: 'MANUAL_VALUE',
      riskLevel: 'MEDIUM',
      note: 'Name based asset. Check comparable sales manually.'
    };
  }

  if (['Spinners', 'Lost Dogs: The Hint', 'Major Achievements', 'X Empire Pre-Market', 'W-Coin Pre-Market', 'Notcoin Pre-Market'].includes(collectionName)) {
    return {
      decision: 'MARKET_CHECK',
      riskLevel: 'MEDIUM',
      note: 'Check live floor and active offers first.'
    };
  }

  return {
    decision: 'REVIEW',
    riskLevel: 'MEDIUM',
    note: 'Needs manual review.'
  };
}

async function fetchWalletNfts(wallet, apiKey) {
  const items = [];
  const limit = 1000;

  for (let page = 0; page < 10; page += 1) {
    const offset = page * limit;
    const url = `${TONAPI_BASE}/v2/accounts/${encodeURIComponent(wallet)}/nfts?limit=${limit}&offset=${offset}`;
    const response = await fetchWithTimeout(url, { headers: headers(apiKey) }, 20000);

    if (!response.ok) throw new Error(`TON NFT API error ${response.status}`);

    const data = await response.json();
    const pageItems = data?.nft_items || [];
    items.push(...pageItems);

    if (pageItems.length < limit) break;
  }

  return items;
}

export async function buildTonNftInventory(config) {
  const apiKey = config.tonApiKey || '';
  const wallets = [...new Set(config.wallets.ton || [])];
  const nfts = [];
  const errors = [];

  for (const wallet of wallets) {
    try {
      const items = await fetchWalletNfts(wallet, apiKey);

      for (const item of items) {
        const nftAddress = text(item.address);
        const metadata = item.metadata || {};
        const collection = item.collection || {};
        const classified = classifyItem(item);

        nfts.push({
          wallet,
          name: text(metadata.name || item.name),
          collection: text(collection.name),
          nftAddress,
          collectionAddress: text(collection.address),
          decision: classified.decision,
          riskLevel: classified.riskLevel,
          note: classified.note,
          tonviewer: `https://tonviewer.com/${nftAddress}`,
          getgems: `https://getgems.io/nft/${nftAddress}`
        });
      }
    } catch (error) {
      errors.push({ wallet, error: error.message });
    }
  }

  return summarize({ generatedAt: new Date().toISOString(), nfts, errors });
}

function summarize(scan) {
  const byDecision = {};
  const byCollection = {};

  for (const item of scan.nfts) {
    byDecision[item.decision] = (byDecision[item.decision] || 0) + 1;
    byCollection[item.collection || '(none)'] = (byCollection[item.collection || '(none)'] || 0) + 1;
  }

  scan.summary = {
    total: scan.nfts.length,
    errors: scan.errors.length,
    byDecision,
    topCollections: Object.entries(byCollection)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([collection, count]) => ({ collection, count }))
  };

  return scan;
}

export function formatTonNftInventory(scan) {
  const lines = [
    'TON NFT inventory',
    `NFTs: ${scan.summary.total}`,
    `Errors: ${scan.summary.errors}`,
    '',
    'Decisions:'
  ];

  for (const [decision, count] of Object.entries(scan.summary.byDecision)) {
    lines.push(`- ${decision}: ${count}`);
  }

  lines.push('', 'Top collections:');
  for (const item of scan.summary.topCollections) {
    lines.push(`- ${item.collection}: ${item.count}`);
  }

  return lines.join('\n');
}
