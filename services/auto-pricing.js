// Auto-pricing for NFTs listed on GetGems using TONAPI.
//
// This module scans configured TON wallets for NFTs in whitelisted
// collections, fetches the current floor price for each collection via
// TONAPI, and automatically lists or relists NFTs slightly below the
// floor price to stay competitive. Prices are never set below a
// configurable minimum per collection to avoid dumping.
//
// Usage:
//   1. Populate the environment variables in your `.env` file:
//        TON_WALLETS            Comma-separated list of your TON wallet addresses
//        TONAPI_BASE            Base URL of the TONAPI endpoint (default: https://tonapi.io)
//        PRICE_UNDERCUT_PCT     Default undercut percentage below floor (e.g. 0.03 for 3%)
//        MIN_PRICE_DEFAULT_TON  Fallback minimum price in TON if no per-collection rule applies
//        RELIST_COOLDOWN_MIN    Cooldown (in minutes) between relists for the same NFT
//        AUTO_PRICE_RULES_JSON  JSON map of collection IDs to pricing rules { undercut, minTon }
//   2. Ensure your sell_getgems.js module exports `listNftForSale(address, priceTon)`
//      and `getNftCurrentListing(address)` (optional but recommended).
//   3. Import and invoke `startAutoPricing()` from your main bot file after
//      launching the bot.
//
// Example AUTO_PRICE_RULES_JSON:
// {
//   "EQAo92DYa0Xl3CwG0x...vZl75iCN": { "undercut": 0.03, "minTon": 20 },
//   "EQAksyWNfo5vGQwky...UTNhk": { "undercut": 0.05, "minTon": 15 }
// }
//
// This will undercut the floor by 3% for the first collection but never
// list below 20 TON, and undercut by 5% for the second collection with a
// minimum of 15 TON.

const axios = require('axios');
const cron = require('node-cron');
const storage = require('../storage');
const { listNftForSale, getNftCurrentListing } = require('../sell_getgems');

const TONAPI_BASE = process.env.TONAPI_BASE || 'https://tonapi.io';

// Helper to parse comma‑separated env lists
function parseEnvList(name) {
  return (process.env[name] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Load per-collection pricing rules from environment.
// Rules example: {
//   "<collectionId>": { "undercut": 0.03, "minTon": 20 }
// }
let COLLECTION_RULES = {};
try {
  COLLECTION_RULES = JSON.parse(process.env.AUTO_PRICE_RULES_JSON || '{}');
} catch (e) {
  console.error('[auto-pricing] Failed to parse AUTO_PRICE_RULES_JSON:', e.message);
  COLLECTION_RULES = {};
}

// Determine pricing rules for a given collection, falling back to
// global defaults if not set.
function getRulesForCollection(collection) {
  const globalUndercut = Number(process.env.PRICE_UNDERCUT_PCT || 0.03);
  const globalMin = Number(process.env.MIN_PRICE_DEFAULT_TON || 0);
  const rules = COLLECTION_RULES[collection] || {};
  return {
    undercut:
      typeof rules.undercut === 'number' ? rules.undercut : globalUndercut,
    minTon: typeof rules.minTon === 'number' ? rules.minTon : globalMin,
  };
}

// Fetch all NFTs held by a wallet via TONAPI.
async function fetchWalletNfts(wallet) {
  const url = `${TONAPI_BASE}/v2/accounts/${wallet}/nfts?limit=1000`;
  const { data } = await axios.get(url);
  const items = data?.nft_items || [];
  return items.map((n) => ({
    address: n.address,
    collection: n.collection?.address || null,
  }));
}

// Fetch the floor price (in TON) for a collection via TONAPI.
async function fetchCollectionFloorTon(collection) {
  const url = `${TONAPI_BASE}/v2/nfts/collections/${collection}`;
  const { data } = await axios.get(url);
  // Attempt to derive floor price from available fields.
  const nanoton =
    data?.stats?.floor_price ||
    data?.floor_price ||
    null;
  if (!nanoton) return null;
  return nanoton / 1e9;
}

// Calculate the target price for an NFT (in TON) based on collection rules.
function calcTargetPriceTon(collection, floorTon) {
  const { undercut, minTon } = getRulesForCollection(collection);
  const raw = floorTon * (1 - undercut);
  return Math.max(raw, minTon);
}

// Process a single wallet: scan for NFTs, group by collection, compute
// target prices, and list or relist NFTs as needed.
async function handleWallet(wallet) {
  console.log('[auto-pricing] Scanning wallet', wallet);
  const nfts = await fetchWalletNfts(wallet);
  // Group NFTs by collection and only include collections in the rules.
  const byCollection = {};
  for (const nft of nfts) {
    const c = nft.collection;
    if (!c || !COLLECTION_RULES[c]) continue;
    if (!byCollection[c]) byCollection[c] = [];
    byCollection[c].push(nft);
  }
  for (const [collection, items] of Object.entries(byCollection)) {
    let floorTon;
    try {
      floorTon = await fetchCollectionFloorTon(collection);
    } catch (e) {
      console.error('[auto-pricing] Failed fetching floor for', collection, e.message);
      continue;
    }
    if (!floorTon) {
      console.warn('[auto-pricing] No floor price found for collection', collection);
      continue;
    }
    const targetTon = calcTargetPriceTon(collection, floorTon);
    const targetNano = Math.ceil(targetTon * 1e9);
    console.log(
      `[auto-pricing] Collection ${collection}, floor=${floorTon.toFixed(2)} TON, target=${targetTon.toFixed(2)} TON`
    );
    for (const nft of items) {
      const key = `auto_price:${nft.address}`;
      let last;
      try {
        last = await storage.get(key);
      } catch (_) {
        last = null;
      }
      const now = Date.now();
      const cooldownMs = (Number(process.env.RELIST_COOLDOWN_MIN || 15) * 60 * 1000);
      if (last && last.price === targetNano && now - last.at < cooldownMs) {
        // Skip relist if target price unchanged and cooldown not expired.
        continue;
      }
      let current;
      try {
        current = await getNftCurrentListing(nft.address);
      } catch (e) {
        console.warn('[auto-pricing] getNftCurrentListing failed for', nft.address, e.message);
      }
      const alreadySame = current && Number(current.priceNanoton || 0) === targetNano;
      if (!alreadySame) {
        console.log(`[auto-pricing] Listing NFT ${nft.address} at ${targetTon.toFixed(2)} TON`);
        try {
          await listNftForSale(nft.address, targetTon);
        } catch (e) {
          console.error('[auto-pricing] Failed to list NFT', nft.address, e.message);
          continue;
        }
      }
      try {
        await storage.set(key, {
          price: targetNano,
          at: now,
          floorTon,
          targetTon,
        });
      } catch (e) {
        console.error('[auto-pricing] Failed to persist state for', nft.address, e.message);
      }
    }
  }
}

// Start periodic auto-pricing cron for configured wallets.
function startAutoPricing() {
  const wallets = parseEnvList('TON_WALLETS');
  if (!wallets.length) {
    console.warn('[auto-pricing] TON_WALLETS not configured; skipping auto-pricing');
    return;
  }
  console.log('[auto-pricing] Starting auto-pricing cron for wallets:', wallets.join(', '));
  // Initial run on startup
  wallets.forEach((w) =>
    handleWallet(w).catch((err) =>
      console.error('[auto-pricing] Error during initial run for', w, err.message)
    )
  );
  // Schedule to run at the 5th minute of every hour
  cron.schedule('5 * * * *', () => {
    wallets.forEach((w) =>
      handleWallet(w).catch((err) =>
        console.error('[auto-pricing] Error during scheduled run for', w, err.message)
      )
    );
  });
}

module.exports = { startAutoPricing };
