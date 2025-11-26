const fetch = require('node-fetch');
const WebSocket = require('ws');

/*
 * Utility functions and helpers for processing NFT marketplace offers on TON.
 * This module normalises API responses from TonAPI and provides a common
 * interface for consuming either streaming or polling events.  Addresses are
 * always converted to lower‑case raw form for consistent comparisons.
 */

/**
 * Parse a comma‑separated list of addresses from an environment variable.  Any
 * leading/trailing whitespace is removed and empty entries are ignored.  All
 * addresses are converted to lower case.  If the input is undefined or blank
 * the function returns undefined.
 *
 * @param {string|undefined} value Raw string from environment
 * @returns {Set<string>|undefined} Normalised set of addresses
 */
function parseAddressList(value) {
  if (!value) return undefined;
  const items = value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .map((v) => v.toLowerCase());
  return items.length > 0 ? new Set(items) : undefined;
}

/**
 * Build an offer filter from environment variables.  Prices are expressed in
 * TON in the environment but converted here to nanoTON (1e9).  If a whitelist
 * or blacklist is present it will be stored as a Set for O(1) lookups.
 *
 * @returns {{minPrice: bigint, whitelist?: Set<string>, blacklist?: Set<string>}}
 */
function buildOfferFilterFromEnv() {
  const minPriceTon = parseFloat(process.env.AUTO_ACCEPT_MIN_TON || '0');
  // Convert TON to nanoTON; BigInt cannot multiply floats directly so use Math.floor
  const minPrice = BigInt(Math.floor(minPriceTon * 1e9));
  const whitelist = parseAddressList(process.env.AUTO_ACCEPT_WHITELIST);
  const blacklist = parseAddressList(process.env.AUTO_ACCEPT_BLACKLIST);
  return { minPrice, whitelist, blacklist };
}

/**
 * Determine whether a given offer passes the provided filter.  The checks are
 * applied in the following order:
 * 1. If a whitelist is defined, the buyer must appear in the whitelist.
 * 2. If a blacklist is defined, the buyer must not appear in the blacklist.
 * 3. The offered price must be greater than or equal to the minimum price.
 *
 * @param {Object} offer Normalised offer event
 * @param {{minPrice: bigint, whitelist?: Set<string>, blacklist?: Set<string>}} filter Filter definition
 * @returns {boolean} True if the offer should be considered
 */
function offerPassesFilter(offer, filter) {
  const buyer = offer.buyer.toLowerCase();
  if (filter.whitelist && !filter.whitelist.has(buyer)) {
    return false;
  }
  if (filter.blacklist && filter.blacklist.has(buyer)) {
    return false;
  }
  if (offer.price < filter.minPrice) {
    return false;
  }
  return true;
}

/**
 * Fetch recent NFT offer events via the TonAPI REST API.  This implements a
 * simple polling mechanism that returns all offer events seen since the last
 * call.  It uses the public events endpoint and filters for NFT offer actions.
 * If a TONAPI key is provided the request will include authentication headers.
 *
 * @param {string|undefined} fromId Optional event ID to resume from; events after this ID will be returned
 * @returns {Promise<Array<Object>>} Array of normalised offer events
 */
async function fetchRecentOfferEvents(fromId) {
  const tonApiKey = process.env.TONAPI_KEY;
  const headers = {
    Accept: 'application/json',
  };
  if (tonApiKey) {
    headers['Authorization'] = `Bearer ${tonApiKey}`;
  }
  const params = new URLSearchParams({
    limit: '50',
    account_events: 'true',
    action_types: 'nft_offer',
  });
  if (fromId) {
    params.set('after_lt', fromId);
  }
  const url = `https://tonapi.io/v2/events?${params.toString()}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch events: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const events = [];
  if (Array.isArray(data.events)) {
    for (const evt of data.events) {
      try {
        if (!Array.isArray(evt.actions)) continue;
        const offerAction = evt.actions.find((a) => a.action_type === 'nft_offer');
        if (!offerAction) continue;
        const nftAddress = offerAction.nft?.address?.toLowerCase();
        const offerAddress = offerAction.offer?.address?.toLowerCase();
        const buyer = offerAction.buyer?.address?.toLowerCase();
        const seller = offerAction.seller?.address?.toLowerCase();
        const price = BigInt(offerAction.price || '0');
        const createdAt = Date.parse(evt.timestamp);
        const eventId = String(evt.event_id || evt.eventId || evt.id);
        if (!nftAddress || !offerAddress || !buyer || !seller) continue;
        events.push({ eventId, nftAddress, offerAddress, buyer, seller, price, createdAt });
      } catch {
        // skip malformed events
        continue;
      }
    }
  }
  return events;
}

/**
 * Start a WebSocket connection to TonAPI to receive real‑time NFT offer events.
 * When NFT offer actions arrive they are normalised and passed to the provided
 * handler.  If the WebSocket closes or encounters an error the client will
 * attempt to reconnect with an exponential backoff.  Returns a function that
 * can be called to close the connection.
 *
 * Note: streaming requires a TonAPI key.  If no key is available this
 * function will throw and callers should fall back to polling.
 *
 * @param {function(Object): void} onOffer Callback invoked for each offer
 * @returns {function(): void} A function to close the WebSocket connection
 */
function streamOfferEvents(onOffer) {
  const tonApiKey = process.env.TONAPI_KEY;
  if (!tonApiKey) {
    throw new Error('streamOfferEvents requires TONAPI_KEY to be set');
  }
  const socketUrl = `wss://tonapi.io/v2/websocket?token=${tonApiKey}`;
  let ws;
  let reconnectDelay = 1000;
  let closedByUser = false;
  const connect = () => {
    ws = new WebSocket(socketUrl);
    ws.on('open', () => {
      const msg = {
        event: 'subscribe',
        data: { type: 'nft_offer' },
      };
      ws?.send(JSON.stringify(msg));
      reconnectDelay = 1000;
    });
    ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.event !== 'nft_offer') return;
        const action = message.data;
        const nftAddress = action.nft?.address?.toLowerCase();
        const offerAddress = action.offer?.address?.toLowerCase();
        const buyer = action.buyer?.address?.toLowerCase();
        const seller = action.seller?.address?.toLowerCase();
        const price = BigInt(action.price || '0');
        const createdAt = Date.now();
        const eventId = String(action.event_id || action.id || createdAt);
        if (!nftAddress || !offerAddress || !buyer || !seller) return;
        onOffer({ eventId, nftAddress, offerAddress, buyer, seller, price, createdAt });
      } catch {
        // ignore malformed messages
      }
    });
    ws.on('error', () => {
      // errors lead to reconnection attempts
    });
    ws.on('close', () => {
      if (closedByUser) return;
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    });
  };
  connect();
  return () => {
    closedByUser = true;
    if (ws) ws.close();
  };
}

/**
 * Unified entry point to listen for new NFT offers.  If a TonAPI key is
 * available the streaming API is used; otherwise the function falls back to
 * periodic polling using the REST API.  The provided callback will be invoked
 * for each new offer event.  The caller is responsible for deduplicating
 * events based on the eventId.
 *
 * @param {function(Object): void} onOffer Handler invoked for each received offer
 * @returns {function(): void} Function to stop listening
 */
function listenForOfferEvents(onOffer) {
  const tonApiKey = process.env.TONAPI_KEY;
  if (tonApiKey) {
    return streamOfferEvents(onOffer);
  }
  const intervalMs = parseInt(process.env.OFFERS_POLL_INTERVAL || '30000', 10);
  let lastEventId;
  let stopped = false;
  const poll = async () => {
    if (stopped) return;
    try {
      const events = await fetchRecentOfferEvents(lastEventId);
      for (const offer of events) {
        lastEventId = offer.eventId;
        onOffer(offer);
      }
    } catch (err) {
      console.error('Failed to fetch offer events', err);
    } finally {
      if (!stopped) {
        setTimeout(poll, intervalMs);
      }
    }
  };
  poll();
  return () => {
    stopped = true;
  };
}

module.exports = {
  parseAddressList,
  buildOfferFilterFromEnv,
  offerPassesFilter,
  fetchRecentOfferEvents,
  streamOfferEvents,
  listenForOfferEvents,
};