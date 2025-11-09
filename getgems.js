// ======================================================
// 🧩 getgems.js — Monitor del marketplace GetGems (TON)
// ======================================================

const EventEmitter = require("events");
const axios = require("axios");
const { loadConfig } = require("./config");

const config = loadConfig();
const emitter = new EventEmitter();

// === Función principal para obtener ofertas recientes ===
async function fetchOffers() {
  try {
    const wallets = config.wallets?.ton || [];

    if (!wallets.length) {
      console.warn("⚠️  No hay wallets TON configuradas en config.wallets.ton");
      return;
    }

    // Lógica de ejemplo (aquí puedes conectar con tonapi.io o GetGems API real)
    console.log("🔍 Escaneando GetGems para wallets:", wallets.join(","));

    // Ejemplo hipotético de llamada:
    // const response = await axios.get(
    //   `https://tonapi.io/v2/accounts/${wallets[0]}/nfts`
    // );
    // const offers = response.data.offers || [];

    const offers = []; // placeholder

    for (const offer of offers) {
      if (!offer.offer_id) continue;
      emitter.emit("offer", offer);
    }
  } catch (err) {
    console.error("❌ Error al obtener ofertas de GetGems:", err.message);
  }
}

// === Bucle de monitoreo automático ===
function startEvents() {
  fetchOffers();
  const interval = parseInt(process.env.GETGEMS_POLL_MINUTES || "2", 10);
  setInterval(fetchOffers, interval * 60 * 1000);
  console.log(`🎨 GetGems listener activo (cada ${interval} min).`);
}

// === Exportar ===
module.exports = {
  emitter,
  startEvents,
};