// sell_getgems.js
//
// Este módulo encapsula la lógica necesaria para listar automáticamente
// NFTs en el marketplace GetGems utilizando el contrato de venta
// `nft-fixprice-sale-v3r3`.  Para colocar un NFT a la venta se deben
// construir varias celdas que describen la venta (precio, tarifas de
// marketplace y royalties) y transferir el NFT a un contrato de venta
// recién desplegado.
//
// Dependencias:
//   - @ton/ton: utilidades para construir celdas y enviar
//     transacciones en la blockchain TON.
//   - @ton/crypto: conversión de mnemónicos a claves.
//   - axios: consulta del inventario de NFTs vía tonapi.
//
// El módulo expone las siguientes funciones:
//   • listNftForSale(nftAddress, priceTon, bot): Lista un NFT concreto
//     a un precio fijo. Devuelve la dirección del contrato de venta.
//   • autoListAll(bot): Recorre las wallets TON configuradas y lista
//     todos los NFTs disponibles al precio por defecto configurado.
//   • startAutoListing(bot, intervalMinutes): Invoca autoListAll en un
//     intervalo periódico para mantener el inventario en venta.

const axios = require('axios');
const { loadConfig } = require('./config');

// Importaciones de @ton/ton y @ton/crypto.  Al utilizar CommonJS
// necesitamos acceder a las propiedades por nombre.
const {
  Address,
  beginCell,
  Cell,
  toNano,
  storeStateInit,
  WalletContractV4,
} = require('@ton/ton');
const { mnemonicToWalletKey } = require('@ton/crypto');

// Boc del contrato `nft-fixprice-sale-v3r3`.  Obtenido de la
// documentación oficial de TON.  Si GetGems actualiza su contrato de
// venta se debe sustituir por la nueva versión publicada en
// https://github.com/getgems-io/nft-contracts.
const NftFixPriceSaleV3R3CodeBoc =
  'te6ccgECDwEAA5MAART/APSkE/S88sgLAQIBYgIDAgLNBAUCASANDgL30A6GmBgLjYSS+Cc' +
  'H0gGHaiaGmAaY/9IH0gfSB9AGppj+mfmBg4KYVjgGAASpiFaY+F7xDhgEoYBWmfxwjFsxsLcxsrZBZjg' +
  'sk5mW8oBfEV4ADJL4dwEuuk4QEWQIEV3RXgAJFZ2Ngp5OOC2HGBFWAA+WjKFkEINjYQQF1AYHAdFmCEA' +
  'X14QBSYKBSML7y4cIk0PpA+gD6QPoAMFOSoSGhUIehFqBSkCH6RFtwgBDIywVQA88WAfoCy2rJcfsAJc' +
  'IAJddJwgKwjhtQRSH6RFtwgBDIywVQA88WAfoCy2rJcfsAECOSNDTiWoMAGQwMWyy1DDQ0wchgCCw8tG' +
  'VIsMAjhSBAlj4I1NBobwE+CMCoLkTsPLRlpEy4gHUMAH7AATwU8fHBbCOXRNfAzI3Nzc3BPoA+gD6ADB' +
  'TIaEhocEB8tGYBdD6QPoA+kD6ADAwyDICzxZY+gIBzxZQBPoCyXAgEEgQNxBFEDQIyMsAF8sfUAXPFlA' +
  'DzxYBzxYB+gLMyx/LP8ntVOCz4wIwMTcowAPjAijAAOMCCMACCAkKCwCGNTs7U3THBZJfC+BRc8cF8uH' +
  '0ghAFE42RGLry4fX6QDAQSBA3VTIIyMsAF8sfUAXPFlADzxYBzxYB+gLMyx/LP8ntVADiODmCEAX14QA' +
  'YvvLhyVNGxwVRUscFFbHy4cpwIIIQX8w9FCGAEMjLBSjPFiH6Astqyx8Vyz8nzxYnzxYUygAj+gITygD' +
  'Jgwb7AHFwVBcAXjMQNBAjCMjLABfLH1AFzxZQA88WAc8WAfoCzMsfyz/J7VQAGDY3EDhHZRRDMHDwBQA' +
  'gmFVEECQQI/AF4F8KhA/y8ADsIfpEW3CAEMjLBVADzxYB+gLLaslx+wBwIIIQX8w9FMjLH1Iwyz8kzxZ' +
  'QBM8WE8oAggnJw4D6AhLKAMlxgBjIywUnzxZw+gLLaswl+kRbyYMG+wBxVWD4IwEIyMsAF8sfUAXPFlA' +
  'DzxYBzxYB+gLMyx/LP8ntVACHvOFnaiaGmAaY/9IH0gfSB9AGppj+mfmC3ofSB9AH0gfQAYKaFQkNDgg' +
  'PlozJP9Ii2TfSItkf0iLcEIIySsKAVgAKrAQAgb7l72omhpgGmP/SB9IH0gfQBqaY/pn5gBaH0gfQB9I' +
  'H0AGCmxUJDQ4ID5aM0U/SItlH0iLZH9Ii2F4ACFiBqqiU';

/**
 * Construye y envía la transacción que coloca un NFT en venta mediante
 * un contrato de precio fijo en GetGems.
 *
 * @param {string} nftAddress Dirección del contrato del NFT (cadena base64 TON).
 * @param {number|string} priceTon Precio deseado en TON (p. ej. 5 para 5 TON).
 * @param {import('telegraf').Telegraf} bot Instancia del bot para notificar (opcional).
 * @returns {Promise<string>} Dirección del contrato de venta desplegado.
 */
async function listNftForSale(nftAddress, priceTon, bot) {
  const config = loadConfig();
  // Recuperar semillas y direcciones desde config o variables de entorno.
  const seed = process.env.TON_WALLET_SEED || config.tonWalletSeed;
  if (!seed) {
    throw new Error('TON_WALLET_SEED no está definido');
  }
  const words = seed.trim().split(/\s+/);
  // Convertir las 24 palabras a clave pública y privada
  const { publicKey, secretKey } = await mnemonicToWalletKey(words);

  // Construir cliente TON para enviar transacciones.  Se utiliza el
  // endpoint definido en TON_API_BASE o una variable dedicada TON_RPC_URL.
  const endpoint = process.env.TON_RPC_URL || config.services?.ton || 'https://tonapi.io/v2/jsonRPC';
  // @ton/ton exporta TonClient en build ES, pero para CommonJS es accesible
  // mediante require('@ton/ton').TonClient.
  const { TonClient } = require('@ton/ton');
  const client = new TonClient({ endpoint });

  // Inicializar la wallet v4 con la clave pública.  Workchain 0 para mainnet.
  const wallet = WalletContractV4.create({ publicKey, workchain: 0 });
  const walletAddress = wallet.address;

  // Calcular valor en nanotones del precio
  const price = toNano(String(priceTon));
  // Direcciones de GetGems desde variables de entorno o config
  const marketplaceAddr = process.env.GETGEMS_MARKETPLACE_ADDRESS || config.getgems?.marketplaceAddress;
  const feeAddr = process.env.GETGEMS_FEE_ADDRESS || config.getgems?.feeAddress;
  const destAddr = process.env.GETGEMS_DESTINATION_ADDRESS || config.getgems?.destinationAddress;
  const royaltyAddr = process.env.GETGEMS_ROYALTY_ADDRESS || config.getgems?.royaltyAddress || walletAddress.toString();

  // Validación mínima
  if (!marketplaceAddr || !feeAddr || !destAddr) {
    throw new Error('Direcciones de GetGems no configuradas correctamente');
  }

  // Construir la celda de tarifas (feesData).  Por defecto se calcula un
  // 5% para el marketplace y un 5% para royalties.  Se puede ajustar
  // modificando este código.
  const marketplaceFee = (price / 100n) * 5n;
  const royaltyFee = (price / 100n) * 5n;
  const feesData = beginCell()
    .storeAddress(Address.parse(feeAddr))
    .storeCoins(marketplaceFee)
    .storeAddress(Address.parse(royaltyAddr))
    .storeCoins(royaltyFee)
    .endCell();

  // Construir la celda de estado de la venta.  Incluye la marca de no
  // completado, fecha de creación, direcciones y precio.
  const saleData = beginCell()
    .storeBit(0) // is_complete
    .storeUint(Math.floor(Date.now() / 1000), 32)
    .storeAddress(Address.parse(marketplaceAddr))
    .storeAddress(Address.parse(nftAddress))
    .storeAddress(walletAddress)
    .storeCoins(price)
    .storeRef(feesData)
    .storeUint(0, 32)
    .storeUint(0, 64)
    .endCell();

  // Decodificar el código del contrato de venta desde Base64
  const codeCell = Cell.fromBoc(Buffer.from(NftFixPriceSaleV3R3CodeBoc, 'base64'))[0];
  const stateInit = { code: codeCell, data: saleData };
  const stateInitCell = beginCell().store(storeStateInit(stateInit)).endCell();

  // Dirección del contrato de venta calculada a partir de stateInit
  const saleContractAddress = new Address(0, stateInitCell.hash());

  // Cuerpo del deploy del contrato de venta (aceptar monedas y desplegar)
  const saleBody = beginCell().storeUint(1, 32).storeUint(0, 64).endCell();

  // Cuerpo de la transferencia del NFT que realizará el deploy
  const transferNftBody = beginCell()
    .storeUint(0x5fcc3d14, 32)
    .storeUint(0, 64)
    .storeAddress(Address.parse(destAddr))
    .storeAddress(walletAddress)
    .storeBit(0)
    .storeCoins(toNano('0.2'))
    .storeBit(0)
    .storeUint(0x0fe0ede, 31)
    .storeRef(stateInitCell)
    .storeRef(saleBody)
    .endCell();

  // Preparar mensaje interno que enviará la wallet.  Se envía 1.1 TON
  // (recomendado 1.08 TON) para cubrir tarifas.  El exceso se devuelve.
  const seqno = await wallet.getSeqno(client);
  const message = {
    to: Address.parse(nftAddress),
    value: toNano('1.1'),
    bounce: true,
    body: transferNftBody,
  };

  await wallet.sendTransfer(client, {
    seqno,
    secretKey,
    messages: [message],
  });

  // Notificar al usuario que la venta se ha iniciado
  try {
    if (bot && config.adminId) {
      await bot.telegram.sendMessage(
        config.adminId,
        `🛍 NFT ${nftAddress} publicado en GetGems por ${priceTon} TON.\nContrato de venta: ${saleContractAddress.toString()}`
      );
    }
  } catch (_) {
    // Ignorar errores de notificación
  }

  return saleContractAddress.toString();
}

/**
 * Recorre las wallets TON configuradas y lista todos los NFTs disponibles
 * al precio por defecto definido en la configuración.  Incluye un
 * pequeño retraso entre listados para evitar alcanzar límites de la API.
 *
 * @param {import('telegraf').Telegraf} bot Instancia del bot para notificaciones.
 */
async function autoListAll(bot) {
  const config = loadConfig();
  const price = config.getgems?.defaultPriceTon || Number(process.env.GETGEMS_DEFAULT_PRICE || 5);
  const tonWallets = config.wallets?.ton || [];
  for (const addr of tonWallets) {
    try {
      // Consultar NFT items de la cuenta
      const res = await axios.get(`${config.services.ton}/accounts/${addr}/nfts`, {
        headers: { 'x-api-key': config.tonApiKey },
      });
      const items = res.data?.nft_items || [];
      for (const item of items) {
        const nft = item.address;
        try {
          await listNftForSale(nft, price, bot);
        } catch (err) {
          console.error('Error al listar NFT', nft, ':', err.message);
        }
        // Esperar 5 segundos entre listados
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch (err) {
      console.error('Error obteniendo NFTs de', addr, ':', err.message);
    }
  }
}

/**
 * Inicia un ciclo automático que lista periódicamente todos los NFTs
 * disponibles.  El intervalo está dado en minutos y se puede ajustar
 * mediante la variable de entorno GETGEMS_LIST_INTERVAL.
 *
 * @param {import('telegraf').Telegraf} bot Bot de Telegram para notificaciones.
 * @param {number} intervalMinutes Intervalo entre listados en minutos.
 */
function startAutoListing(bot, intervalMinutes) {
  const minutes = intervalMinutes || Number(process.env.GETGEMS_LIST_INTERVAL || 60);
  // Lanzar inmediatamente
  autoListAll(bot).catch(() => {});
  // Lanzar periódicamente
  setInterval(() => {
    autoListAll(bot).catch(() => {});
  }, minutes * 60 * 1000);
}

module.exports = {
  listNftForSale,
  autoListAll,
  startAutoListing,
};
