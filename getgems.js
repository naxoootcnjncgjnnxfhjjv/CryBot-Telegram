// getgems.js
// Módulo encargado de escuchar eventos del marketplace GetGems.
// Este archivo emite eventos 'offer' cuando detecta una oferta para NFTs de la
// colección configurada. El contenido de cada evento debe incluir:
// { nft_id, price_ton, buyer, offer_id, wallet_owner, collection_id }.

const EventEmitter = require('events');
const axios = require('axios');
const { loadConfig } = require('./config');

const config = loadConfig();
// Emitter global al que otros módulos pueden suscribirse.
const emitter = new EventEmitter();

// Función para obtener ofertas recientes del marketplace. En una
// implementación real se conectaría a la API oficial de GetGems o a un
// servicio de notificación. Aquí se deja un stub que devuelve un array
// vacío; el desarrollador deberá completar esta función.
async function fetchOffers() {
  try {
    // TODO: Integrar API GetGems para recibir ofertas. Ejemplo de endpoint
    // (hipotético) para ilustrar:
    // const response = await axios.get(
    //   `https://api.getgems.io/v1/offers?collection=${config.collectionTonPunks}&wallets=${config.wallets.ton.join(',')}`
    // );
    // const offers = response.data.offers;
    const offers = [];
    for (const offer of offers) {
      // Validar campos mínimos
      if (!offer.offer_id) continue;
      emitter.emit('offer', offer);
    }
  } catch (err) {
    console.error('❌ Error al obtener ofertas de GetGems:', err.message);
  }
}

// Inicia el ciclo de polling de eventos cada 2 minutos.
function startEvents() {
  fetchOffers();
  setInterval(fetchOffers, 2 * 60 * 1000);
}

module.exports = {
  emitter,
  startEvents,
};