import { Address } from '@ton/core';
import fetch from 'node-fetch';
import WebSocket from 'ws';

/**
 * Representation of an NFT offer as returned by TonAPI.  This is a simplified
 * structure used internally by the bot to decide whether or not to accept
 * the offer.  Real‐world TonAPI responses include many more fields; only
 * those relevant to the auto‑accept logic are included here.  All addresses
 * are normalised to lower‑case raw form to simplify comparisons.
 */
export interface OfferEvent {
  /** Unique identifier for the event */
  eventId: string;
  /** Address of the NFT being offered */
  nftAddress: string;
  /** Address of the offer contract (e.g. nft‑offer‑v1r3) */
  offerAddress: string;
  /** Buyer address extracted from the offer */
  buyer: string;
  /** Seller address (owner of the NFT) */
  seller: string;
  /** Offered price in nanoTON (1e‑9 TON) */
  price: bigint;
  /** Block Unix timestamp when the offer was created */
  createdAt: number;
}

/**
 * Options controlling which offers are considered acceptable.  These values
 * generally come from environment variables but can be overridden for
 * testing.  Prices are expressed in nanoTON; if the user specifies TON in
 * the environment the helper in this file will convert them.
 */
export interface OfferFilter {
  /** Minimum price in nanoTON; offers below this price will be ignored */
  minPrice: bigint;
  /** If present, only offers whose buyer is in this set will be accepted */
  whitelist?: Set<string>;
  /** If present, offers whose buyer is in this set will be ignored */
  blacklist?: Set<string>;
}

/**
 * Internal helper to parse a comma separated list of addresses from an
 * environment variable.  Leading/trailing whitespace is trimmed and empty
 * strings are removed.  Addresses are normalised to lower‑case.  If the
 * environment variable is undefined or blank the returned set will be
 * undefined.
 */
export function parseAddressList(value?: string): Set<string> | undefined {
  if (!value) return undefined;
  const items = value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .map((v) => v.toLowerCase());
  return items.length > 0 ? new Set(items) : undefined;
}

/**
 * Builds an {@link OfferFilter} from process environment variables.  This
 * encapsulates the logic for parsing minimum price (in TON) and
 * whitelists/blacklists from comma separated lists.  If no minimum price is
 * provided the default is zero.
 */
export function buildOfferFilterFromEnv(): OfferFilter {
  const minPriceTon = parseFloat(process.env.AUTO_ACCEPT_MIN_TON || '0');
  // Convert TON to nanoTON (1 TON = 10^9 nanoTON)
  const minPrice = BigInt(Math.floor(minPriceTon * 1e9));
  const whitelist = parseAddressList(process.env.AUTO_ACCEPT_WHITELIST);
  const blacklist = parseAddressList(process.env.AUTO_ACCEPT_BLACKLIST);
  return { minPrice, whitelist, blacklist };
}

/**
 * Determines whether a given {@link OfferEvent} passes the provided
 * {@link OfferFilter}.  The checks are applied in the following order:
 *  1. If a whitelist is defined, the buyer must appear in the whitelist.
 *  2. If a blacklist is defined, the buyer must not appear in the blacklist.
 *  3. The offered price must be greater than or equal to the minimum price.
 *
 * The buyer address is expected to be normalised to lower‑case.  If an
 * address in the whitelist or blacklist is malformed or in a different
 * representation, comparisons may not work correctly.  This function
 * assumes addresses are in raw form (without any user‑friendly prefix).
 */
export function offerPassesFilter(offer: OfferEvent, filter: OfferFilter): boolean {
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
 * Fetches recent NFT offer events via the TonAPI REST API.  This function
 * implements a polling mechanism that returns all offer events seen since
 * the last call.  It uses the public events endpoint and filters for NFT
 * offer actions.  If a TONAPI key is provided the request will include
 * authentication headers.  This function does not perform any
 * deduplication; callers are responsible for tracking processed event IDs.
 *
 * Note: The TonAPI events endpoint is not intended for building business
 * logic (per the documentation).  It is used here as a best effort
 * fallback when WebSocket streaming is unavailable.  For reliable
 * production usage use the streaming API instead.
 *
 * @param fromId Optional event ID to resume from; events after this ID
 *   will be returned.  If omitted the API will return the most recent
 *   events.
 */
export async function fetchRecentOfferEvents(fromId?: string): Promise<OfferEvent[]> {
  const tonApiKey = process.env.TONAPI_KEY;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (tonApiKey) {
    headers['Authorization'] = `Bearer ${tonApiKey}`;
  }
  // Build query parameters; filter for action_type NFT_SALE_OFFER to
  // restrict results to offer creation events.  The limit is kept low to
  // reduce bandwidth; if you need more events adjust accordingly.
  const params = new URLSearchParams({
    limit: '50',
    account_events: 'true',
    // Only fetch events containing NFT marketplace offers.  According to
    // TonAPI documentation the action type is `nft_purchased` for sales
    // and `nft_offer` for offers.  We'll filter on the latter.
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
  const events: OfferEvent[] = [];
  if (Array.isArray(data.events)) {
    for (const evt of data.events) {
      try {
        // Each event contains an array of actions.  We're interested in
        // NFT offer actions.  If multiple actions are present we skip.
        if (!Array.isArray(evt.actions)) continue;
        const offerAction = evt.actions.find((a: any) => a.action_type === 'nft_offer');
        if (!offerAction) continue;
        // Extract relevant fields; values may be nested differently based on
        // API version.  Use optional chaining and fallbacks to avoid
        // exceptions.
        const nftAddress = offerAction.nft?.address?.toLowerCase();
        const offerAddress = offerAction.offer?.address?.toLowerCase();
        const buyer = offerAction.buyer?.address?.toLowerCase();
        const seller = offerAction.seller?.address?.toLowerCase();
        const price = BigInt(offerAction.price || '0');
        const createdAt = Date.parse(evt.timestamp);
        const eventId = String(evt.event_id || evt.eventId || evt.id);
        if (!nftAddress || !offerAddress || !buyer || !seller) continue;
        events.push({
          eventId,
          nftAddress,
          offerAddress,
          buyer,
          seller,
          price,
          createdAt,
        });
      } catch {
        // Skip malformed events gracefully
        continue;
      }
    }
  }
  return events;
}

/**
 * Starts a WebSocket connection to TonAPI to receive real‑time events.  When
 * NFT offer actions arrive they are normalised into {@link OfferEvent}
 * objects and passed to the provided handler.  If the WebSocket closes or
 * encounters an error the client will attempt to reconnect with an
 * exponential backoff.  Returns a function that can be called to close
 * the connection.
 *
 * WebSocket streaming requires a TonAPI key.  If no key is available
 * this function throws an error; callers should fall back to polling.
 */
export function streamOfferEvents(onOffer: (offer: OfferEvent) => void): () => void {
  const tonApiKey = process.env.TONAPI_KEY;
  if (!tonApiKey) {
    throw new Error('streamOfferEvents requires TONAPI_KEY to be set');
  }
  const socketUrl = `wss://tonapi.io/v2/websocket?token=${tonApiKey}`;
  let ws: WebSocket | undefined;
  let reconnectDelay = 1000;
  let closedByUser = false;

  const connect = () => {
    ws = new WebSocket(socketUrl);
    ws.on('open', () => {
      // Subscribe to NFT offer events.  The subscription message format is
      // documented in TonAPI streaming API docs: we send a JSON object
      // specifying the event type and filters.  Here we subscribe to
      // nft_offer actions globally.
      const msg = {
        event: 'subscribe',
        data: {
          type: 'nft_offer',
        },
      };
      ws?.send(JSON.stringify(msg));
      // Reset backoff on successful connection
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
      // Errors lead to reconnection attempts
    });
    ws.on('close', () => {
      if (closedByUser) return;
      // schedule reconnection with exponential backoff capped at 30 seconds
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    });
  };
  connect();
  return () => {
    closedByUser = true;
    ws?.close();
  };
}

/**
 * Unified entry point to listen for new NFT offers.  If a TonAPI key is
 * available the streaming API is used; otherwise the function falls back to
 * periodic polling using the REST API.  The provided callback will be
 * invoked for each new offer event.  The caller is responsible for
 * deduplicating events based on {@link OfferEvent.eventId}.
 *
 * @param onOffer Handler invoked for each received offer
 */
export function listenForOfferEvents(onOffer: (offer: OfferEvent) => void): () => void {
  const tonApiKey = process.env.TONAPI_KEY;
  if (tonApiKey) {
    return streamOfferEvents(onOffer);
  }
  // Poll every OFFERS_POLL_INTERVAL milliseconds or default to 30 seconds
  const intervalMs = parseInt(process.env.OFFERS_POLL_INTERVAL || '30000', 10);
  let lastEventId: string | undefined;
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
      // Log errors but do not stop polling
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