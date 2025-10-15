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

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN no definido');
  process.exit(1);
}

// ===== Keepalive HTTP (Railway) =====
const app = express();
app.get('/', (_req, res) => res.send('CryBot OK'));
app.listen(PORT, () => console.log(`HTTP ✅ on :${PORT}`));

// ===== Telegram Bot (Long Polling, sin webhook) =====
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
  // Simple: consulta saldo ETH + placeholder para tokens
  // (Tokens reales requieren indexado adicional o APIs de terceros)
  return { tokens: [], note: 'Para tokens ERC-20 usaré fuente indexada en la siguiente iteración.' };
}

async function tonGetBalance(friendlyAddr) {
  try {
    const r = await axios.get(`${TON_API_BASE}/v2/accounts/${friendlyAddr}`, {
      headers: { Authorization: `Bearer ${TON_API_KEY}` }
    });
    // TonAPI devuelve balance en nanotons
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
  return { listed: 0, notes: 'Se requiere firma. Dejamos hook preparado.' };
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

  const [eth, ton] = await Promise.all([
    EVM_WALLET ? evmEthBalance(EVM_WALLET) : null,
    TON_WALLET ? tonGetBalance(TON_WALLET) : null
  ]);

  const parts = [];
  if (EVM_WALLET) parts.push(`• EVM (${EVM_WALLET}): ${eth === null ? 'error' : `${fmt(eth)} ETH`}`);
  if (TON_WALLET) parts.push(`• TON (${TON_WALLET}): ${ton === null ? 'error' : `${fmt(ton)} TON`}`);
  parts.push(`→ Principal: ${MAIN_WALLET}`);

  await ctx.reply(['💰 *Saldos*', ...parts].join('\n'), { parse_mode: 'Markdown' });
});

bot.command('scan', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_TELEGRAM_ID)) return;
  await ctx.reply('🔍 Escaneando wallets…');

  const tokens = await evmTokensViaEtherscan(EVM_WALLET);
  const airdropsTon = await tonScanAirdrops(TON_WALLET);

  await ctx.reply(
    `✅ Escaneo listo.\n` +
    `• ERC-20 (EVM): ${tokens.tokens.length} (nota: ${tokens.note})\n` +
    `• Airdrops TON: ${airdropsTon.length}`
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
    // 1) escanear
    await evmTokensViaEtherscan(EVM_WALLET);
    await tonScanAirdrops(TON_WALLET);
    // 2) (opcional) reclamar en protocolos soportados
    // await claimAirdropsAll();
    // 3) (opcional) enviar a principal si hay claves privadas y límites
  } catch (e) {
    console.error('Cron error:', e.message);
  }
});

// ===== Lanzar bot =====
bot.launch().then(() => {
  console.log(`🤖 CryBot listo (modo ${NODE_ENV}). Admin: ${ADMIN_TELEGRAM_ID}`);
});

// Cierre limpio
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
// minor update
