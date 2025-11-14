const { ethers } = require('ethers');
const { loadConfig } = require('../config');

// Cargar configuración
const config = loadConfig();

// Crear provider y wallet para Polygon
const provider = config.polygonRpcUrl ? new ethers.JsonRpcProvider(config.polygonRpcUrl) : null;
const wallet = (provider && config.privateKey) ? new ethers.Wallet(config.privateKey, provider) : null;

let notify = null;
const recentSales = [];

/**
 * Define la función de notificación para enviar mensajes por Telegram.
 * @param {Function} fn Función (mensaje) → void
 */
function setNotifier(fn) {
  notify = fn;
}

/**
 * Obtiene el saldo en MATIC de la wallet EVM configurada.
 */
async function getEvmBalance() {
  if (!wallet) return '0';
  try {
    const balance = await provider.getBalance(wallet.address);
    return ethers.utils.formatEther(balance);
  } catch (err) {
    console.error('Error al obtener saldo EVM:', err.message);
    return '0';
  }
}

/**
 * Obtiene los NFTs de PlanetIX en la wallet configurada.
 * NOTA: Esto es un placeholder; se debe implementar leyendo el contrato ERC-721 de PlanetIX.
 */
async function getInventory() {
  // Aquí se debería usar ethers + ABI para listar los tokenIds del usuario
  // Por ahora devuelve array vacío
  return [];
}

async function getInventoryCount() {
  const tokens = await getInventory();
  return tokens.length;
}

/**
 * Obtiene la mejor oferta para un token. Placeholder: retorna null.
 * @param {string|number} tokenId Id del NFT
 */
async function getBestOffer(tokenId) {
  // Esto debería llamar al contrato de marketplace de PlanetIX para obtener ofertas
  return null;
}

async function acceptOffer(tokenId, price) {
  console.log(`Aceptar oferta para PIX ${tokenId} por ${price} IXT`);
  recentSales.push({
    platform: 'planetix',
    asset: tokenId,
    price,
    currency: 'IXT',
  });
  if (notify) {
    await notify(`✅ Venta PlanetIX: PIX ${tokenId} vendido por ${price} IXT (simulación).`);
  }
}

async function listForSale(tokenId, price) {
  console.log(`Listar PIX ${tokenId} por ${price} IXT`);
  if (notify) {
    await notify(`⚠ Se listó PIX ${tokenId} a ${price} IXT (no implementado).`);
  }
}

/**
 * Comprueba los NFTs de PlanetIX y vende según criterios:
 * - Si existe una oferta ≥ precio mínimo (PLANETIX_MIN_PRICE), se acepta la oferta.
 * - De lo contrario, lista el NFT a la venta a ese precio mínimo.
 */
async function checkAndSell() {
  const tokens = await getInventory();
  for (const tokenId of tokens) {
    const minPrice = parseFloat(process.env.PLANETIX_MIN_PRICE || '0');
    const offer = await getBestOffer(tokenId);
    if (offer && offer >= minPrice) {
      await acceptOffer(tokenId, offer);
    } else {
      await listForSale(tokenId, minPrice);
    }
  }
}

function getRecentSales() {
  return recentSales;
}

module.exports = {
  setNotifier,
  getEvmBalance,
  getInventoryCount,
  checkAndSell,
  getRecentSales,
};
