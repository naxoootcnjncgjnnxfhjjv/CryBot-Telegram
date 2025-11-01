// payout.js
// Módulo encargado de transferir los fondos obtenidos tras la venta de NFTs.
// Puede enviar TON a una wallet central o iniciar el puente hacia EVM.

const { loadConfig } = require('./config');
const storage = require('./storage');

async function handleSale(offer, bot) {
  const config = loadConfig();
  const amountTon = offer.price_ton;
  try {
    // Modo puente hacia EVM
    if (config.autoBridgeToEvm) {
      // TODO: integrar swap + bridge. Aquí solo simulamos el flujo.
      await bot.telegram.sendMessage(
        config.adminId,
        `🌉 Iniciando puente de ${amountTon} TON hacia EVM (${config.withdrawEvmAddress})...`
      );
      // Simulamos tx hash de puente
      const bridgeHash = 'bridge_' + offer.offer_id;
      storage.updateStatus(offer.offer_id, 'BRIDGED');
      await bot.telegram.sendMessage(
        config.adminId,
        `💸 Completado puente. Hash: ${bridgeHash}`
      );
    } else {
      // Enviar fondos TON a la wallet de liquidación
      const settlement = config.tonSettlementWallet || offer.wallet_owner;
      await bot.telegram.sendMessage(
        config.adminId,
        `💸 Transferencia de ${amountTon} TON a tu wallet de liquidación ${settlement}.`
      );
      // Simulamos tx hash
      const txHash = 'tx_' + offer.offer_id;
      storage.updateStatus(offer.offer_id, 'PAID');
      await bot.telegram.sendMessage(
        config.adminId,
        `✅ Fondos enviados. Hash: ${txHash}`
      );
    }
  } catch (err) {
    await bot.telegram.sendMessage(
      config.adminId,
      `❌ Error al transferir fondos: ${err.message}`
    );
  }
}

module.exports = {
  handleSale,
};