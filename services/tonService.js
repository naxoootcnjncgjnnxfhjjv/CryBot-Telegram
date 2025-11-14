const axios = require('axios');
const TonWeb = require('tonweb');
const { loadConfig } = require('../config');

// Cargar configuración al inicializar el módulo
const config = loadConfig();

// Variable para notificaciones
let notify = null;

// Almacena ventas recientes para comandos /ventas
const recentSales = [];

/**
 * Define la función de notificación que se usará para avisar al usuario por Telegram.
 * @param {Function} fn Función que recibe un mensaje de texto para enviar al usuario
 */
function setNotifier(fn) {
  notify = fn;
}

/**
 * Devuelve el saldo (en TON) de la wallet configurada.
 * Usa tonapi.io para obtener el balance.
 * @returns {Promise<string>} Saldo en TON formateado
 */
async function getTonBalance() {
  if (!config.tonWallet) return '0';
  try {
    const res = await axios.get(`${config.tonApiBase}/v2/accounts/${config.tonWallet}`, {
      headers: { 'X-API-Key': config.tonApiKey },
    });
    const balanceNano = res.data.balance || '0';
    const balance = parseFloat(balanceNano) / 1e9;
    return balance.toFixed(2);
  } catch (err) {
    console.error('Error al obtener saldo TON:', err.message);
    return '0';
  }
}

/**
 * Obtiene el listado de NFTs (items) en la wallet TON configurada.
 * @returns {Promise<Array>} Lista de NFTs
 */
async function getInventory() {
  if (!config.tonWallet) return [];
  try {
    const res = await axios.get(`${config.tonApiBase}/v2/accounts/${config.tonWallet}/nfts`, {
      headers: { 'X-API-Key': config.tonApiKey },
    });
    return res.data.nfts || [];
  } catch (err) {
    console.error('Error al obtener NFTs de TON:', err.message);
    return [];
  }
}

/**
 * Cuenta cuántos NFTs hay en inventario.
 */
async function getInventoryCount() {
  const nfts = await getInventory();
  return nfts.length;
}

/**
 * Obtiene (placeholder) el precio mínimo de una colección. Aquí debería integrarse con la API de GetGems o
 * calcular a partir de otros datos. Por simplicidad, se usa GETGEMS_DEFAULT_PRICE o un valor fijo.
 * @param {string} collectionId ID de la colección (no usado en placeholder)
 */
async function getFloorPrice(collectionId) {
  return parseFloat(process.env.GETGEMS_DEFAULT_PRICE || '5');
}

/**
 * Lista un NFT para la venta mediante contrato fix-price. Esta función es un placeholder y
 * debe implementarse con la librería TON adecuada y la lógica de los contratos de GetGems.
 * @param {Object} nft Objeto del NFT obtenido de tonapi
 * @param {number} price Precio en TON al que se listará
 */
async function listForSale(nft, price) {
  console.log(`Listar NFT ${nft.address} por ${price} TON`);
  if (notify) {
    await notify(`⚠ Se listó NFT ${nft.address} a la venta por ${price} TON (este módulo necesita implementación real).`);
  }
}

/**
 * Acepta una oferta para un NFT. Placeholder; debe implementarse cuando existan ofertas on-chain en GetGems.
 * @param {Object} nft Objeto del NFT
 * @param {number} offerPrice Precio ofrecido
 */
async function acceptOffer(nft, offerPrice) {
  console.log(`Aceptar oferta por NFT ${nft.address} por ${offerPrice} TON`);
  // Registrar la venta en el historial local
  recentSales.push({
    platform: 'ton',
    asset: nft.address,
    price: offerPrice,
    currency: 'TON',
  });
  if (notify) {
    await notify(`✅ Venta en TON: NFT ${nft.address} vendido por ${offerPrice} TON (simulación).`);
  }
}

/**
 * Función principal para comprobar NFT en cartera y venderlos si cumplen condiciones.
 * - Calcula el floor de cada NFT
 * - Comprueba si hay ofertas ≥ porcentaje mínimo del floor
 * - Acepta la oferta o lista el NFT al precio base
 */
async function checkAndSell() {
  const nfts = await getInventory();
  for (const nft of nfts) {
    const floorPrice = await getFloorPrice(nft.collection?.address || '');
    const minPrice = floorPrice * config.getgemsMinimumPercentage;
    // TODO: integrar consulta de ofertas reales. Por ahora no hay ofertas.
    const offer = null;
    if (offer && offer >= minPrice) {
      await acceptOffer(nft, offer);
    } else {
      // Solo listar si no está listado; placeholder simplificado
      await listForSale(nft, floorPrice);
    }
  }
}

/**
 * Devuelve el historial de ventas recientes en TON.
 */
function getRecentSales() {
  return recentSales;
}

module.exports = {
  setNotifier,
  getTonBalance,
  getInventoryCount,
  checkAndSell,
  getRecentSales,
};
