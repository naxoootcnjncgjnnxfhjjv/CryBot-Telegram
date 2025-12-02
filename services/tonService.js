// services/tonService.js

const axios = require('axios');
const config = require('../config');

// Obtener balance TON de todas las wallets configuradas
async function getTonBalances() {
  if (!config.TON_API_KEY) {
    console.log("[TON] Falta TON_API_KEY en Railway");
    return;
  }

  if (config.TON_WALLETS.length === 0) {
    console.log("[TON] No hay TON_WALLETS configuradas");
    return;
  }

  for (const wallet of config.TON_WALLETS) {
    try {
      const url = `https://toncenter.com/api/v2/getBalance?account=${wallet}&api_key=${config.TON_API_KEY}`;
      const res = await axios.get(url);

      const ton = res.data.result / 1e9;
      console.log(`[TON] ${wallet} -> ${ton} TON`);
    } catch (err) {
      console.error(`[TON] Error en ${wallet}:`, err.message);
    }
  }
}

// Placeholder — aquí va la integración real con TonWeb o TonSDK
async function sendTon(fromWallet, toWallet, amount) {
  console.log(`[TON] Simulando envío ${amount} TON de ${fromWallet} a ${toWallet}`);
}

// Placeholder para auto‑reclamos (ej. para TON Whales, Tonkeeper, etc.)
async function scanAndClaimAirdrops() {
  for (const wallet of config.TON_WALLETS) {
    console.log(`[TON] Escaneando airdrops en ${wallet}`);
  }
}

// Inicia el cron
async function startPolling() {
  console.log(`[TON] Polling activo cada ${config.POLL_INTERVAL / 1000}s`);
  setInterval(async () => {
    await getTonBalances();
    await scanAndClaimAirdrops();
  }, config.POLL_INTERVAL);
}

module.exports = {
  getTonBalances,
  sendTon,
  scanAndClaimAirdrops,
  startPolling,
};