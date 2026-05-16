const { listenForOfferEvents, offerPassesFilter, buildOfferFilterFromEnv } = require('../ton/offers');
const { acceptNftOffer } = require('../ton/accept');
const fetch = require('node-fetch');

async function sendTelegramNotification(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
  } catch (err) {
    console.error('Failed to send Telegram notification:', err.message);
  }
}

function isTruthy(value) {
  return value === '1' || value === 'true' || value === 'yes';
}

function startOffersAcceptor() {
  const enabled = isTruthy(process.env.AUTO_ACCEPT_ENABLED);
  const writeActionsEnabled = isTruthy(process.env.ENABLE_WRITE_ACTIONS);
  const dryRun = !writeActionsEnabled || isTruthy(process.env.DRY_RUN);

  if (!enabled) {
    console.log('Auto-accept offers job disabled. Set AUTO_ACCEPT_ENABLED=true to enable monitoring.');
    return () => {};
  }

  if (!writeActionsEnabled) {
    console.warn('ENABLE_WRITE_ACTIONS is not true. Offers acceptor will run in DRY_RUN mode only.');
  }

  const myWallet = process.env.TON_WALLET_ADDR
    ? process.env.TON_WALLET_ADDR.toLowerCase()
    : undefined;

  if (!myWallet) {
    console.warn('TON_WALLET_ADDR is not defined. Ownership checks may be incomplete.');
  }

  const filter = buildOfferFilterFromEnv();
  const processed = new Set();

  console.log('Starting NFT offers acceptor', { dryRun });

  const stop = listenForOfferEvents(async (offer) => {
    const eventId = offer.eventId || `${offer.nftAddress}:${offer.offerAddress}:${offer.price}`;
    if (processed.has(eventId)) return;
    processed.add(eventId);

    if (myWallet && offer.seller && offer.seller.toLowerCase() !== myWallet) {
      console.log('Ignoring offer for NFT not owned by configured wallet:', offer.nftAddress);
      return;
    }

    if (!offerPassesFilter(offer, filter)) {
      console.log('Offer rejected by filter:', offer.nftAddress);
      return;
    }

    const acceptParams = {
      nftAddress: offer.nftAddress,
      offerAddress: offer.offerAddress,
      responseAddress: myWallet || offer.seller,
      forwardAmount: offer.price,
      queryId: BigInt(Date.now()),
      payload: undefined
    };

    try {
      if (dryRun) {
        const result = await acceptNftOffer(acceptParams, true);
        await sendTelegramNotification(
          `DRY_RUN offer match: NFT ${offer.nftAddress}, price ${Number(offer.price) / 1e9} TON. No transaction sent.`
        );
        console.log('Dry-run offer emulation:', result.emulation || result);
        return;
      }

      const result = await acceptNftOffer(acceptParams, false);
      await sendTelegramNotification(
        `Accepted offer for NFT ${offer.nftAddress}, price ${Number(offer.price) / 1e9} TON. Tx: ${result.hash}`
      );
      console.log('Accepted NFT offer:', result.hash);
    } catch (err) {
      console.error('Failed to process NFT offer:', err.message);
      await sendTelegramNotification(`Failed to process offer for NFT ${offer.nftAddress}: ${err.message}`);
    }
  });

  return stop;
}

module.exports = {
  startOffersAcceptor
};
