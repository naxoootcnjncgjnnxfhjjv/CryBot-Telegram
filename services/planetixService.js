const { ethers } = require('ethers');
const { loadConfig } = require('../config');

// Cargar configuración
const config = loadConfig();

// Crear provider y wallet para Polygon
const provider = config.polygonRpc ? new ethers.JsonRpcProvider(config.polygonRpc) : null;
const wallet = provider && config.privateKey ? new ethers.Wallet(config.privateKey, provider) : null;

let notify = null;
const recentSales = [];

function setNotifier(fn) {
  notify = fn;
}

async function getEvmBalance() {
  if (!wallet) return '0';
  try {
    const balance = await provider.getBalance(wallet.address);
    return ethers.formatEther(balance);
  } catch (err) {
    console.error('Error al obtener saldo EVM:', err.message);
    return '0';
  }
}

/**
 * Obtiene los NFTs de PlanetIX en la wallet configurada.
 * Usa balanceOf y tokenOfOwnerByIndex para enumerar los tokens.
 */
async function getInventory() {
  if (!provider || !wallet || !config.planetix.collectionAddress || !config.planetix.abi) {
    return [];
  }
  try {
    const contract = new ethers.Contract(
      config.planetix.collectionAddress,
      config.planetix.abi,
      provider
    );
    const balanceBN = await contract.balanceOf(wallet.address);
    const balance = balanceBN.toNumber();
    const tokens = [];
    for (let i = 0; i < balance; i++) {
      const tokenId = await contract.tokenOfOwnerByIndex(wallet.address, i);
      tokens.push(tokenId.toString());
    }
    return tokens;
  } catch (err) {
    console.error('Error al obtener NFTs de PlanetIX:', err.message);
    return [];
  }
}

async function getInventoryCount() {
  const tokens = await getInventory();
  return tokens.length;
}

async function getBestOffer(tokenId) {
  // Este bot no acepta ni realiza ofertas de PlanetIX automáticamente por motivos de seguridad.
  return null;
}

async function acceptOffer(tokenId, price) {
  console.log(`Aceptar oferta para PIX ${tokenId} por ${price} IXT`);
  recentSales.push({ platform: 'planetix', asset: tokenId, price, currency: 'IXT' });
  if (notify) {
    await notify(`✅ Venta PlanetIX (simulación): PIX ${tokenId} vendido por ${price} IXT`);
  }
}

async function listForSale(tokenId, price) {
  console.log(`Listar PIX ${tokenId} por ${price} IXT`);
  if (notify) {
    await notify(`⚠ Se listó PIX ${tokenId} por ${price} IXT (este módulo es de demostración)`);
  }
}

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
  getInventory,
  getInventoryCount,
  checkAndSell,
  getRecentSales,
};
