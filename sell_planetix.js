// sell_planetix.js
//
// Este módulo gestiona la aceptación automática de ofertas para NFTs en
// la plataforma Planet IX (red Polygon/Base).  La lógica consiste en
// consultar periódicamente el contrato de marketplace para obtener
// ofertas pendientes sobre los NFTs del usuario, asegurar la
// autorización (approval) del marketplace sobre el contrato NFT y
// posteriormente aceptar cada oferta de manera automática.
//
// La implementación utiliza ethers.js, que ya forma parte de las
// dependencias del proyecto.  Se espera que el ABI del contrato de
// marketplace proporcione al menos dos métodos:
//   • getOffers(address owner) → returns Offer[]
//   • acceptOffer(uint256 tokenId, uint256 price) → transacción
//   • Cada Offer debe exponer tokenId, price y opcionalmente
//     collection (dirección del contrato NFT).
//
// Dado que Planet IX puede actualizar sus contratos, este módulo
// incluye gestión de errores robusta y fallará silenciosamente si
// no se encuentra el método esperado.  La configuración de las
// direcciones y la clave privada se obtiene de las variables de
// entorno o del archivo config.js.

const { ethers } = require('ethers');
const { loadConfig } = require('./config');

// ABI mínima para contratos ERC721 necesaria para realizar
// comprobaciones y approvals.  Incluye isApprovedForAll y
// setApprovalForAll.
const ERC721_ABI = [
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved) external',
];

/**
 * Consulta el marketplace de Planet IX para obtener las ofertas
 * disponibles sobre los NFTs del usuario y las acepta todas de forma
 * automática.  Si las funciones esperadas no existen, captura el
 * error y registra el fallo.  Tras cada venta exitosa envía una
 * notificación por Telegram.
 *
 * @param {import('telegraf').Telegraf} bot Instancia del bot para notificar.
 */
async function fetchOffersAndAccept(bot) {
  const config = loadConfig();
  const pk = process.env.POLYGON_PRIVATE_KEY || config.polygonPrivateKey;
  const rpc = process.env.POLYGON_RPC_URL || config.polygonRpc || 'https://polygon-rpc.com';
  const marketplaceAddr = process.env.PLANETIX_MARKETPLACE_ADDRESS || config.planetix?.marketplaceAddress;
  if (!pk || !marketplaceAddr) {
    // No hay configuración para Planet IX; abortar silenciosamente
    return;
  }
  const provider = new ethers.JsonRpcProvider(rpc);
  const signer = new ethers.Wallet(pk, provider);
  const owner = await signer.getAddress();
  // Obtener ABI del marketplace si se ha definido en config; de lo contrario
  // utilizar un ABI genérico con los métodos mencionados.  Esto permite
  // compatibilidad básica incluso sin ABI personalizado.
  const abi = config.planetix?.abi || [
    'function getOffers(address owner) view returns (tuple(uint256 tokenId, uint256 price, address collection)[])',
    'function acceptOffer(uint256 tokenId, uint256 price) external',
  ];
  const marketplace = new ethers.Contract(marketplaceAddr, abi, signer);
  let offers;
  try {
    offers = await marketplace.getOffers(owner);
  } catch (err) {
    console.error('Error obteniendo ofertas PlanetIX:', err.message);
    if (bot && config.adminId) {
      await bot.telegram.sendMessage(
        config.adminId,
        `❌ Error consultando ofertas PlanetIX: ${err.message}`
      );
    }
    return;
  }
  if (!offers || offers.length === 0) {
    return;
  }
  for (const o of offers) {
    const tokenId = o.tokenId ?? o[0];
    const price = o.price ?? o[1];
    const collection = o.collection ?? o[2] ?? config.planetix?.collectionAddress;
    if (!tokenId || !price || !collection) continue;
    try {
      // Comprobar approval para el marketplace; si no existe, aprobar
      const nftContract = new ethers.Contract(collection, ERC721_ABI, signer);
      const approved = await nftContract.isApprovedForAll(owner, marketplaceAddr);
      if (!approved) {
        const apprTx = await nftContract.setApprovalForAll(marketplaceAddr, true);
        await apprTx.wait();
      }
      // Aceptar la oferta.  Muchos marketplaces requieren pasar
      // únicamente tokenId, pero otros requieren también el valor ofertado.
      let tx;
      try {
        tx = await marketplace.acceptOffer(tokenId, price);
      } catch (inner) {
        // Intentar llamada alternativa: algunos contratos aceptan sólo tokenId
        tx = await marketplace.acceptOffer(tokenId);
      }
      await tx.wait();
      // Notificar la venta exitosa
      const humanPrice = Number(ethers.formatEther(price));
      if (bot && config.adminId) {
        await bot.telegram.sendMessage(
          config.adminId,
          `🎉 NFT vendido en PlanetIX: token ${tokenId} por ${humanPrice} MATIC/IXT`
        );
      }
    } catch (err) {
      console.error('Error aceptando oferta PlanetIX:', err.message);
      if (bot && config.adminId) {
        await bot.telegram.sendMessage(
          config.adminId,
          `⚠️ Fallo al aceptar oferta PlanetIX (token ${tokenId}): ${err.message}`
        );
      }
    }
  }
}

/**
 * Inicia un ciclo de monitorización periódica de ofertas en PlanetIX.
 * Por defecto revisa cada 5 minutos, pero se puede ajustar mediante
 * la variable de entorno PLANETIX_POLL_MINUTES o pasándolo como
 * parámetro.  Tras cada ejecución se llaman a fetchOffersAndAccept.
 *
 * @param {import('telegraf').Telegraf} bot Instancia del bot para notificar.
 * @param {number} intervalMinutes Intervalo en minutos entre revisiones.
 */
function startMonitoring(bot, intervalMinutes) {
  const minutes = intervalMinutes || Number(process.env.PLANETIX_POLL_MINUTES || 5);
  fetchOffersAndAccept(bot).catch(() => {});
  setInterval(() => {
    fetchOffersAndAccept(bot).catch(() => {});
  }, minutes * 60 * 1000);
}

module.exports = {
  fetchOffersAndAccept,
  startMonitoring,
};
