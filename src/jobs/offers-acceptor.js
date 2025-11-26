const { listenForOfferEvents, offerPassesFilter, buildOfferFilterFromEnv } = require('../ton/offers');
const { acceptNftOffer } = require('../ton/accept');
const fetch = require('node-fetch');

/*
 * Orchestrates the auto‑acceptance of NFT offers on TON.  This module
 * subscribes to the offer event stream (either via WebSocket or polling) and
 * determines which offers should be accepted based on the configured filter.
 * Each offer is processed at most once to prevent duplicate acceptances.
 */

/**
 * Send a plain text Telegram message if TELEGRAM_BOT_TOKEN and
 * TELEGRAM_ALERT_CHAT_ID are configured.  Errors are logged but otherwise
 * ignored.
 *
 * @param {string} message Message to send
 */
async function sendTelegramNotification(message) {
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
 * Start listening for NFT offers and automatically accept those that pass the
 * configured filter.  The function respects environment variables:
 *   AUTO_ACCEPT_ENABLED – if not truthy the job will not start
 *   DRY_RUN – if truthy offers are emulated but not sent on‑chain
 *   TON_WALLET_ADDR – used to verify ownership of NFTs
 *
 * @returns {function(): void} A function to stop listening
 */
function startOffersAcceptor() {
  const enabled = process.env.AUTO_ACCEPT_ENABLED === '1' || process.env.AUTO_ACCEPT_ENABLED === 'true';
  if (!enabled) {
    console.log('Auto‑accept offers job is disabled');
    return () => {};
  }
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  const myWallet = process.env.TON_WALLET_ADDR ? process.env.TON_WALLET_ADDR.toLowerCase() : undefined;
  if (!myWallet) {
    console.warn('TON_WALLET_ADDR is not defined; cannot determine NFT ownership');
  }
  const filter = buildOfferFilterFromEnv();
  const processed = new Set();
  console.log('Starting NFT offers acceptor; dryRun=', dryRun);
  const stop = listenForOfferEvents(async (offer) => {
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
    const acceptParams = {
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

module.exports = {
  startOffersAcceptor,
};