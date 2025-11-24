// ======================================================
// 🧩 sell_getgems.js — Listado automático de NFTs en GetGems
// ======================================================
//
// Este módulo lista NFTs automáticamente en el marketplace GetGems
// utilizando el contrato `nft-fixprice-sale-v3r3`.
// Permite listar los NFTs de tus wallets TON con precios por defecto.
//
// ======================================================

const axios = require("axios");
const { loadConfig } = require("./config");
const {
  Address,
  beginCell,
  Cell,
  toNano,
  storeStateInit,
  WalletContractV4,
} = require("@ton/ton");
const { mnemonicToWalletKey } = require("@ton/crypto");

// Código BOC del contrato de venta fija (GetGems)
const NftFixPriceSaleV3R3CodeBoc =
  "te6ccgECDwEAA5MAART/APSkE/S88sgLAQIBYgIDAgLNBAUCASANDgL30A6GmBgLjYSS+Cc" +
  "H0gGHaiaGmAaY/9IH0gfSB9AGppj+mfmBg4KYVjgGAASpiFaY+F7xDhgEoYBWmfxwjFsxsLcxsrZBZjg" +
  "sk5mW8oBfEV4ADJL4dwEuuk4QEWQIEV3RXgAJFZ2Ngp5OOC2HGBFWAA+WjKFkEINjYQQF1AYHAdFmCEA" +
  "X14QBSYKBSML7y4cIk0PpA+gD6QPoAMFOSoSGhUIehFqBSkCH6RFtwgBDIywVQA88WAfoCy2rJcfsAJc" +
  "IAJddJwgKwjhtQRSH6RFtwgBDIywVQA88WAfoCy2rJcfsAECOSNDTiWoMAGQwMWyy1DDQ0wchgCCw8tG" +
  "VIsMAjhSBAlj4I1NBobwE+CMCoLkTsPLRlpEy4gHUMAH7AATwU8fHBbCOXRNfAzI3Nzc3BPoA+gD6ADB" +
  "TIaEhocEB8tGYBdD6QPoA+kD6ADAwyDICzxZY+gIBzxZQBPoCyXAgEEgQNxBFEDQIyMsAF8sfUAXPFlA" +

zxYBzxYB+gLMyx/LP8ntVOCz4wIwMTcowAPjAijAAOMCCMACCAkKCwCGNTs7U3THBZJfC+BRc8cF8uH" +
  "0ghAFE42RGLry4fX6QDAQSBA3VTIIyMsAF8sfUAXPFlADzxYBzxYB+gLMyx/LP8ntVADiODmCEAX14QA" +
  "YvvLhyVNGxwVRUscFFbHy4cpwIIIQX8w9FCGAEMjLBSjPFiH6Astqyx8Vyz8nzxYnzxYUygAj+gITygD" +
  "Jgwb7AHFwVBcAXjMQNBAjCMjLABfLH1AFzxZQA88WAc8WAfoCzMsfyz/J7VQAGDY3EDhHZRRDMHDwBQA" +
  "gmFVEECQQI/AF4F8KhA/y8ADsIfpEW3CAEMjLBVADzxYB+gLLaslx+wBwIIIQX8w9FMjLH1Iwyz8kzxZ" +
  "QBM8WE8oAggnJw4D6AhLKAMlxgBjIywUnzxZw+gLLaswl+kRbyYMG+wBxVWD4IwEIyMsAF8sfUAXPFlA" +
  "DzxYBzxYB+gLMyx/LP8ntVACHvOFnaiaGmAaY/9IH0gfSB9AGppj+mfmC3ofSB9AH0gfQAYKaFQkNDgg" +
  "PlozJP9Ii2TfSItkf0iLcEIIySsKAVgAKrAQAgb7l72omhpgGmP/SB9IH0gfQBqaY/pn5gBaH0gfQB9I" +
  "H0AGCmxUJDQ4ID5aM0U/SItlH0iLZH9Ii2F4ACFiBqqiU";

// === Función principal: listar NFT ===
async function listNftForSale(nftAddress, priceTon, bot) {
  const config = loadConfig();
  const seed = process.env.TON_WALLET_SEED || config.tonWalletSeed;
  if (!seed) throw new Error("TON_WALLET_SEED no está definido");

  const words = seed.trim().split(/\s+/);
  const { publicKey, secretKey } = await mnemonicToWalletKey(words);

  const endpoint =
    process.env.TON_RPC_URL ||
    config.services?.ton ||
    "https://tonapi.io/v2/jsonRPC";

  const { TonClient } = require("@ton/ton");
  const client = new TonClient({ endpoint });

  const wallet = WalletContractV4.create({ publicKey, workchain: 0 });
  const walletAddress = wallet.address;
  const price = toNano(String(priceTon));

  // Direcciones de GetGems desde variables de entorno o config
  const marketplaceAddr =
    process.env.GETGEMS_MARKETPLACE_ADDRESS ||
    config.getgems?.marketplaceAddress;
  const feeAddr =
    process.env.GETGEMS_FEE_ADDRESS || config.getgems?.feeAddress;
  const destAddr =
    process.env.GETGEMS_DESTINATION_ADDRESS ||
    config.getgems?.destinationAddress ||
    walletAddress.toString();
  const royaltyAddr =
    process.env.GETGEMS_ROYALTY_ADDRESS ||
    config.getgems?.royaltyAddress ||
    walletAddress.toString();

  // Validación mínima
  if (!marketplaceAddr) {
    console.warn(
      "⚠️ Advertencia: falta GETGEMS_MARKETPLACE_ADDRESS, se usará modo local sin envío real."
    );
  }

  // Calcular tarifas del marketplace (5%) y royalties (5%)
  const marketplaceFee = (price / 100n) * 5n;
  const royaltyFee = (price / 100n) * 5n;

  const feesData = beginCell()
    .storeAddress(Address.parse(feeAddr || walletAddress.toString()))
    .storeCoins(marketplaceFee)
    .storeAddress(Address.parse(royaltyAddr))
    .storeCoins(royaltyFee)
    .endCell();

  // Construir celda del contrato de venta
  const saleData = beginCell()
    .storeBit(0)
    .storeUint(Math.floor(Date.now() / 1000), 32)
    .storeAddress(Address.parse(marketplaceAddr || walletAddress.toString()))
    .storeAddress(Address.parse(nftAddress))
    .storeAddress(walletAddress)
    .storeCoins(price)
    .storeRef(feesData)
    .storeUint(0, 32)
    .storeUint(0, 64)
    .endCell();

  const codeCell = Cell.fromBoc(Buffer.from(NftFixPriceSaleV3R3CodeBoc, "base64"))[0];
  const stateInit = { code: codeCell, data: saleData };
  const stateInitCell = beginCell().store(storeStateInit(stateInit)).endCell();
  const saleContractAddress = new Address(0, stateInitCell.hash());
  const saleBody = beginCell().storeUint(1, 32).storeUint(0, 64).endCell();

  // Cuerpo de transferencia del NFT
  const transferNftBody = beginCell()
    .storeUint(0x5fcc3d14, 32)
    .storeUint(0, 64)
    .storeAddress(Address.parse(destAddr))
    .storeAddress(walletAddress)
    .storeBit(0)
    .storeCoins(toNano("0.2"))
    .storeBit(0)
    .storeUint(0x0fe0ede, 31)
    .storeRef(stateInitCell)
    .storeRef(saleBody)
    .endCell();

  // Preparar y enviar transacción
  const seqno = await wallet.getSeqno(client);
  const message = {
    to: Address.parse(nftAddress),
    value: toNano("1.1"),
    bounce: true,
    body: transferNftBody,
  };

  await wallet.sendTransfer(client, {
    seqno,
    secretKey,
    messages: [message],
  });

  // Notificar por Telegram
  try {
    if (bot && config.adminId) {
      await bot.telegram.sendMessage(
        config.adminId,
        `🛍 NFT ${nftAddress} publicado en GetGems por ${priceTon} TON.\nContrato de venta: ${saleContractAddress.toString()}`
      );
    }
  } catch (_) {}

  return saleContractAddress.toString();
}

// === Listar todos los NFTs de tus wallets ===
async function autoListAll(bot) {
  const config = loadConfig();
  const price =
    config.getgems?.defaultPriceTon ||
    Number(process.env.GETGEMS_DEFAULT_PRICE || 5);
  const tonWallets = config.wallets?.ton || [];

  for (const addr of tonWallets) {
    try {
      const res = await axios.get(`${config.services.ton}/accounts/${addr}/nfts`, {
        headers: { "x-api-key": config.tonApiKey },
      });
      const items = res.data?.nft_items || [];

      for (const item of items) {
        const nft = item.address;
        try {
          await listNftForSale(nft, price, bot);
        } catch (err) {
          console.error("Error al listar NFT", nft, ":", err.message);
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch (err) {
      console.error("Error obteniendo NFTs de", addr, ":", err.message);
    }
  }
}

// === Ciclo automático de listado ===
function startAutoListing(bot, intervalMinutes) {
  const minutes = intervalMinutes || Number(process.env.GETGEMS_LIST_INTERVAL || 60);
  autoListAll(bot).catch(() => {});
  setInterval(() => {
    autoListAll(bot).catch(() => {});
  }, minutes * 60 * 1000);
}

module.exports = {
  listNftForSale,
  autoListAll,
    startAutoListing,

       etNftCurrentListing,

  
};
