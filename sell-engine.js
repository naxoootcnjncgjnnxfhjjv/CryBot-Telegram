// sell-engine.js
// Módulo que procesa ofertas de venta para NFTs. Decide si aceptar
// automáticamente o generar un enlace TonConnect para firmar desde la app.

const { loadConfig } = require('./config');
const storage = require('./storage');
const payout = require('./payout');
const { sendSignatureLink } = require('./signatureLinks');

const { Markup } = require('telegraf');

// Genera un deep link TonConnect/Tonkeeper. Esta función utiliza un
// placeholder; en una integración real se debe construir la transacción
// correctamente y codificarla en base64 según el protocolo TonConnect.
function generateTonConnectLink(offer) {
  const amount = offer.price_ton;
  const nft = offer.nft_id;
  // Placeholder: deep link genérico al transfer; debe reemplazarse.
  return `https://app.tonkeeper.com/transfer?amount=${amount}&comment=Accept%20offer%20for%20${nft}`;
}

async function processOffer(offer, bot) {
  const config = loadConfig();
  // Validar colección
  if (offer.collection_id !== config.collectionTonPunks) return;
  // Umbral mínimo
  if (Number(offer.price_ton) < config.minOfferTon) return;
  // Verificar propiedad del NFT
  if (!config.wallets.ton.includes(offer.wallet_owner)) return;
  // Evitar duplicados
  if (storage.isProcessed(offer.offer_id)) return;
  // Registrar oferta
  storage.recordOffer(offer.offer_id, {
    ...offer,
    status: 'NEW',
    created_at: Date.now(),
  });

  // Lógica de aceptación
  const autoAcceptPossible = config.autoAccept && Object.keys(config.tonPrivateKeys || {}).length > 0;
  if (autoAcceptPossible) {
    // Modo automático: simular aceptación y envío a payout
    await bot.telegram.sendMessage(
      config.adminId,
      `🤖 Autoaceptando oferta de ${offer.price_ton} TON para NFT ${offer.nft_id} (id oferta ${offer.offer_id}).`
    );
    storage.updateStatus(offer.offer_id, 'SOLD');
    // Llamar al módulo de pagos
    await payout.handleSale(offer, bot); 
  }  
 felse if(process.env.MODE === 'rea=l') {
  const txPayload = {
    offer_id: offer.offer_id,
    price_ton: offer.price_ton,
    nft_id: offer.nft_id,
    buyer: offer.buyer,
    wallet_owner: offer.wallet_owner,
  };
  const ctx = { telegram: bot.telegram, chat: { id: config.adminId } };
  sendSignatureLink(ctx, txPayload, 'TON', `Oferta detectada: NFT ${offer.nft_id} — ${offer.price_ton} TON`);
} else {
  consst link = generateTonConnectLink(offer);
  await bot.telegram.sendMessage(
    config.adminId,
    `Nueva oferta detectada para tu NFT ${offer.nft_id} por ${offer.price_ton} TON.\n\nEnlace para aceptarla: ${link}`
  );
  
}
// Update status after sending signature link or TonConnect link
storage.updateStatus(offer.offer_id, 'PENDING_SIGN');
}

module.exports = {
  processOffer,
};
