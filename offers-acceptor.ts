import { listenForOfferEvents, offerPassesFilter, buildOfferFilterFromEnv, OfferEvent } from '../ton/offers';
import { acceptNftOffer, AcceptOfferParams } from '../ton/accept';
import { Address, Cell } from '@ton/core';
import fetch from 'node-fetch';

/**
 * Sends a text message to a Telegram chat if the necessary environment
 * variables are present.  Failures are logged but otherwise ignored.
 */
async function sendTelegramNotification(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch (err) {
    console.error('Failed to send Telegram notification', err);
  }
}

/**
 * Orchestrates the auto‑acceptance of NFT offers.  This function sets up
 * listeners for new offers and attempts to accept them if they pass the
 * configured filters.  Each offer is processed exactly once and duplicate
 * processing is avoided via an in‑memory set of processed event IDs.
 */
export function startOffersAcceptor(): () => void {
  const enabled = process.env.AUTO_ACCEPT_ENABLED === '1' || process.env.AUTO_ACCEPT_ENABLED === 'true';
  if (!enabled) {
    console.log('Auto‑accept offers job is disabled');
    return () => {};
  }
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  const myWallet = process.env.TON_WALLET_ADDR?.toLowerCase();
  if (!myWallet) {
    console.warn('TON_WALLET_ADDR is not defined; cannot determine NFT ownership');
  }
  const filter = buildOfferFilterFromEnv();
  const processed = new Set<string>();
  console.log('Starting NFT offers acceptor; dryRun=', dryRun);
  const stop = listenForOfferEvents(async (offer: OfferEvent) => {
    // Deduplicate
    if (processed.has(offer.eventId)) return;
    processed.add(offer.eventId);
    // Ownership check
    if (myWallet && offer.seller && offer.seller.toLowerCase() !== myWallet) {
      console.log('Ignoring offer for NFT not owned by us', offer.nftAddress);
      return;
    }
    // Filter check
    if (!offerPassesFilter(offer, filter)) {
      console.log('Offer does not pass filter', offer);
      return;
    }
    // Build accept parameters.  We forward the offered price to the offer
    // contract.  The response address is our wallet so that sale proceeds
    // return to us if the offer contract requires it.
    const acceptParams: AcceptOfferParams = {
      nftAddress: offer.nftAddress,
      offerAddress: offer.offerAddress,
      responseAddress: myWallet || offer.seller,
      forwardAmount: offer.price,
      queryId: BigInt(Date.now()),
      payload: undefined,
    };
    try {
      if (dryRun) {
        const result = await acceptNftOffer(acceptParams, true);
        await sendTelegramNotification(
          `Dry‑run accept offer for NFT ${offer.nftAddress} at price ${Number(offer.price) / 1e9} TON.\nEmulation: ${JSON.stringify(result.emulation)}`,
        );
        console.log('Dry‑run emulation result', result.emulation);
      } else {
        const result = await acceptNftOffer(acceptParams, false);
        await sendTelegramNotification(
          `Accepted offer for NFT ${offer.nftAddress} at price ${Number(offer.price) / 1e9} TON.\nTx hash: ${result.hash}`,
        );
        console.log('Accepted NFT offer, tx hash', result.hash);
      }
    } catch (err) {
      console.error('Failed to accept NFT offer', err);
      await sendTelegramNotification(`Failed to accept offer for NFT ${offer.nftAddress}: ${String(err)}`);
    }
  });
  return stop;
}