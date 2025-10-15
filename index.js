require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Telegraf } = require('telegraf');
const { ethers } = require('ethers');
const cron = require('node-cron');

// ===== Config =====
const {
  BOT_TOKEN,
  ADMIN_TELEGRAM_ID,
  EVM_WALLET,
  TON_WALLET,
  MAIN_WALLET,
  ETHERSCAN_API_KEY,
  TON_API_KEY,
  RPC_URL = 'https://ethereum.publicnode.com',
  TON_API_BASE = 'https://tonapi.io',
  PORT = 3000,
  NODE_ENV = 'production'
} = process.env;

// ===== Wallets list =====
const EVM_WALLETS = [
  '0x7B9Fc90C99b2ae4711BDE31049c357999e79B09',
  '0x5e66fa97ebec4a39166cf5c323cdc6a3538f1848',
  '0xf37465e2978d90a8feae048d0e15c338d04aa4d6',
  '0x63249c93dac1f243390eafe6b62f4bf8d3bf118bc2ce6a8abd83e59091da9409',
  '0x3047325B11dB6839dcE749a214B4750eBbEA36Ac', // wallet limpia destino
  '0x82219fc3B1d22f0DAd2703101724dfA8f08DC456', // wallet principal destino
  '0x14287D44a3aA5D7025D2cAeBD415a2673F7bEC3E', // BSC
  '0x11353909627b83813dee8d578a636bd042223308acebda7ff1e4220b861de6eb' // registrada / Aptos
];

const TON_WALLETS = [
  'UQBSINhOenZdPyDmV3bfeQ1Hu-Z-zyITBJj0uisC0RmH0GxT',
  'UQChtGxrxo1H74kGde0GNsSKWYG_rhGMKNco-opmWQ1B-yil',
  'UQDY-o0QuHWumsIKstom7sXBzlX2nxfQ27-czr1e0e9qpmQVI',
  'UQC9kJgmw5M5DI9tCOWYZYUEOKRplC0dFDD45cCPFtkv',
  'TYKiq9tJ3r9SZL3bSYnNRQn9N9IsR92S4KwTg',
  'UQAMPb0pQJnP1sSAQUPYMwGkEC0ggQYQB0NjN810Bghc',
  'UQCVzJYJ3prLF27-5QaDv5rTxK6o93nThw0n1CsCxy9N',
  'TYKiq9j3srJI3mC4q7zRzgSN565ym3SxIO7TPvoPSY0Cb4zaCo', // Additional addresses (if any)
  'UQAMPbQpQJtnPlsSaQUQYMwGkEC0ggQYQ8hj0tNB0lghkT', // repeated but kept for completeness
  'UQCcLv7JUPrlFZ7-504vbxfTxK6o93nHTwwN-Qv16NsCRy20'
];

const SOL_WALLETS = [
  'EEb1yJtp3X2nwF4x0ZoHEdGnsa2BQZfsvwjAJBucatr7'
];

const BTC_WALLETS = [
  '3QUtkPuPy3RwRMiPuyBDHZVMxndxDG9Ba'
];

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN no definido');
  process.exit(1);
}

// ===== Keepalive HTTP (Railway) =====
const app = express();
app.get('/', (_req, res) => res.send('CryBot OK'));
app.listen(PORT, () => console.log(`HTTP ✅ on :${PORT}`));

// ===== Telegram Bot (Long Polling) =====
const bot = new Telegraf(BOT_TOKEN);

// ===== Providers =====
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ===== Helpers =====
const fmt = (n) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 6 });

async function evmEthBalance(addr) {
  try {
    const wei = await provider.getBalance(addr);
    return Number(ethers.formatEther(wei));
  } catch (e) {
    console.error('EVM balance error:', e.message);
    return null;
  }
}

async function evmTokensViaEtherscan(addr) {
  // Placeholder: consulta saldo ETH + placeholder para tokens
  // (Tokens reales requieren indexado adicional o APIs de terceros)
  return { tokens: [], note: 'Para tokens ERC-20 usaré fuente indexada en la siguiente iteración.' };
}

async function tonGetBalance(friendlyAddr) {
  try {
    const r = await axios.get(`${TON_API_BASE}/v2/accounts/${friendlyAddr}`, {
      headers: { Authorization: `Bearer ${TON_API_KEY}` }
    });
    const nano = r.data?.balance ?? 0;
    return Number(nano) / 1e9;
  } catch (e) {
    console.error('TON balance error:', e?.response?.data || e.message);
    return null;
  }
}

async function tonScanAirdrops(friendlyAddr) {
  // Placeholder: en siguiente iteración añadimos flujos reales por colecciones/jettons
  return [];
}

async function tonListNftsForSale(friendlyAddr) {
  // Placeholder de listados automáticos (Getgems): requiere firma → flujo avanzado
  return { listed: 0, notes: 'Se requiere firma. Hook preparado.' };
}

async function claimAirdropsAll() {
  // Aquí insertar lógicas por protocolos (Galxe, Layer3, Zora, etc.) con sus APIs.
  return { claimed: 0, protocols: [] };
}

async function autoPayoutToMain() {
  // Transferencias reales requieren claves privadas/relayer.
  // No tenemos claves privadas confirmadas → por seguridad, solo reporto.
  return { sent: 0, note: 'Transferencias deshabilitadas: no hay claves privadas seguras cargadas.' };
}

// ===== Comandos =====
bot.start(async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_TELEGRAM_ID)) {
    return ctx.reply('⛔️ Acceso restringido.');
  }
  await ctx.reply('✅ CryBot activo.\nUsa /saldo, /scan, /reclamar, /vender, /enviar');
});

bot.command('saldo', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_TELEGRAM_ID)) return;
  await ctx.reply('⏳ Consultando saldos…');

  // Obtener saldos de todas las wallets
  const ethBalances = await Promise.all(
    EVM_WALLETS.map((addr) => evmEthBalance(addr))
  );
  const tonBalances = await Promise.all(
    TON_WALLETS.map((addr) => tonGetBalance(addr))
  );

  const parts = [];
  EVM_WALLETS.forEach((addr, idx) => {
    const bal = ethBalances[idx];
    parts.push(
      `• EVM (${addr}): ${bal === null ? 'error' : `${fmt(bal)} ETH`}`
    );
  });
  TON_WALLETS.forEach((addr, idx) => {
    const bal = tonBalances[idx];
    parts.push(
      `• TON (${addr}): ${bal === null ? 'error' : `${fmt(bal)} TON`}`
    );
  });
  parts.push(`→ Principal: ${MAIN_WALLET}`);

  await ctx.reply(['💰 *Saldos*', ...parts].join('\n'), {
    parse_mode: 'Markdown',
  });
});

bot.command('scan', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_TELEGRAM_ID)) return;
  await ctx.reply('🔎 Escaneando wallets…');

  // Scan tokens for each EVM wallet
  const tokenResults = await Promise.all(
    EVM_WALLETS.map((addr) => evmTokensViaEtherscan(addr))
  );
  const totalTokens = tokenResults.reduce((acc, res) => acc + (res.tokens?.length || 0), 0);
  const notes = tokenResults.map((res) => res.note).join('; ');

  // Scan airdrops for each TON wallet
  const airdropsResults = await Promise.all(
    TON_WALLETS.map((addr) => tonScanAirdrops(addr))
  );
  const totalAirdrops = airdropsResults.reduce((acc, arr) => acc + arr.length, 0);

  await ctx.reply(
    `✅ Escaneo listo.\n` +
      `• ERC-20 (EVM): ${totalTokens} (nota: ${notes})\n` +
      `• Airdrops TON: ${totalAirdrops}`
  );
});

bot.command('reclamar', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_TELEGRAM_ID)) return;
  await ctx.reply('🎁 Buscando y reclamando airdrops…');
  const res = await claimAirdropsAll();
  await ctx.reply(`✅ Reclamación finalizada. Total: ${res.claimed}. Protocolos: ${res.protocols.join(', ') || '—'}`);
});

bot.command('vender', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_TELEGRAM_ID)) return;
  await ctx.reply('🛒 Listando NFTs automáticamente (requiere firma)…');
  const res = await tonListNftsForSale(TON_WALLET);
  await ctx.reply(`✅ NFTs listados: ${res.listed}. Nota: ${res.notes}`);
});

bot.command('enviar', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_TELEGRAM_ID)) return;
  await ctx.reply('💸 Envío automático hacia wallet principal…');
  const res = await autoPayoutToMain();
  await ctx.reply(`ℹ️ ${res.note}`);
});

// ===== Tareas automáticas (cada 10 min) =====
cron.schedule('*/10 * * * *', async () => {
  try {
    console.log('⏱️ Cron: escaneo + reclamo soft');
    // Escanear todas las wallets
    await Promise.all(EVM_WALLETS.map((addr) => evmTokensViaEtherscan(addr)));
    await Promise.all(TON_WALLETS.map((addr) => tonScanAirdrops(addr)));
    // (Opcional) reclamar en protocolos soportados
    // await claimAirdropsAll();
  } catch (e) {
    console.error('Cron error:', e.message);
  }
});

// ===== Lanzar bot =====
bot.launch().then(() => {
  console.log(`🤖 CryBot listo (modo ${NODE_ENV}). Admin: ${ADMIN_TELEGRAM_ID}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
