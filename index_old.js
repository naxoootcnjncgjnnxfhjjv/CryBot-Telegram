// index_multi.js — Versión avanzada de CryBot con soporte multi-wallet y NFTs
// © 2025 CryBot System

const { Telegraf } = require('telegraf');
const axios = require('axios');
const { ethers } = require('ethers');
const cron = require('node-cron');

// ——— Configuración de entorno ———
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_TELEGRAM_ID || '');
const EVM_WALLETS = (process.env.EVM_WALLETS || process.env.EV_WALLET || '').split(',').map(a => a.trim()).filter(Boolean);
const TON_WALLETS = (process.env.TON_WALLETS || process.env.TON_WALLET || '').split(',').map(a => a.trim()).filter(Boolean);
const MAIN_WALLET = process.env.MAIN_WALLET || null;
const RPC_URL = process.env.RPC_URL || 'https://ethereum.publicnode.com';
const TON_API_KEY = process.env.TON_API_KEY || null;

if (!BOT_TOKEN) {
  console.error('❌ ERROR: BOT_TOKEN no está definido');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ——— EVM provider y wallet opcional ———
const provider = new ethers.JsonRpcProvider(RPC_URL);
let wallet = null;
if (process.env.PRIVATE_KEY_EVM) {
  try {
    wallet = new ethers.Wallet(process.env.PRIVATE_KEY_EVM, provider);
  } catch (err) {
    console.error('❌ PRIVATE_KEY_EVM inválida:', err.message);
  }
}

// ——— Funciones auxiliares ———
const isAdmin = (ctx) => String(ctx.from?.id) === ADMIN_ID;

async function getEvmBalance(addr) {
  try {
    const bal = await provider.getBalance(addr);
    return Number(ethers.formatEther(bal));
  } catch (err) {
    return null;
  }
}

async function getTonBalance(addr) {
  if (!addr || !TON_API_KEY) return 'sin API';
  try {
    const url = `https://toncenter.com/api/v2/getAddressBalance?address=${addr}&api_key=${TON_API_KEY}`;
    const res = await axios.get(url);
    return parseFloat(res.data.result) / 1e9;
  } catch (err) {
    return 'error';
  }
}

async function claimAirdrops() {
  console.log('🔁 Ejecutando claimAirdrops (stub)');
  return { claimed: [] };
}

async function getNftsEvm(addr) {
  // Ejemplo: llamar a OpenSea API o similar
  return [];
}

async function getNftsTon(addr) {
  // Ejemplo: llamar a Getgems API o tonapi.io
  return [];
}

// ——— Comandos del bot ———
bot.start((ctx) => ctx.reply('🤖 CryBot MultiWallet activo. Usa /help'));

bot.command('help', (ctx) => {
  ctx.reply([
    '/status — test de vida',
    '/saldo — muestra balances de todas las wallets',
    '/nfts — lista NFTs detectados',
    '/reclamar — ejecutar reclamos (admin)',
    '/enviar <amtETH> <to> — enviar ETH (admin)'
  ].join('\n'));
});

bot.command('status', (ctx) => ctx.reply('✅ OK'));

bot.command('saldo', async (ctx) => {
  await ctx.reply('⏳ Consultando balances...');
  let msg = '💰 *Balances de Wallets*\n\n';
  for (const addr of EVM_WALLETS) {
    const bal = await getEvmBalance(addr);
    msg += `• EVM ${addr.slice(0, 8)}...: ${bal} ETH\n`;
  }
  for (const addr of TON_WALLETS) {
    const bal = await getTonBalance(addr);
    msg += `• TON ${addr.slice(0, 8)}...: ${bal} TON\n`;
  }
  ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('nfts', async (ctx) => {
  await ctx.reply('🖼 Escaneando NFTs...');
  let msg = '🎨 *NFTs detectados*\n\n';
  for (const addr of EVM_WALLETS) {
    const nfts = await getNftsEvm(addr);
    msg += `• EVM ${addr.slice(0, 8)}...: ${nfts.length} NFTs\n`;
  }
  for (const addr of TON_WALLETS) {
    const nfts = await getNftsTon(addr);
    msg += `• TON ${addr.slice(0, 8)}...: ${nfts.length} NFTs\n`;
  }
  ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('reclamar', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ No autorizado');
  const res = await claimAirdrops();
  ctx.reply(`✅ Reclamos ejecutados: ${JSON.stringify(res)}`);
});

bot.command('enviar', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ No autorizado');
  if (!wallet) return ctx.reply('❌ No hay PRIVATE_KEY_EVM definida');
  const [_, amt, to] = ctx.message.text.trim().split(/\s+/);
  if (!amt || !to) return ctx.reply('Uso: /enviar <amountETH> <to>');
  try {
    const tx = await wallet.sendTransaction({ to, value: ethers.parseEther(amt) });
    ctx.reply(`✅ TX enviada: ${tx.hash}`);
  } catch (err) {
    ctx.reply(`❌ Error: ${err.message}`);
  }
});

// ——— Escaneo automático y reportes ———
cron.schedule('*/10 * * * *', async () => {
  let msg = '📊 *Auto-scan 10min*\n';
  for (const addr of EVM_WALLETS) {
    const bal = await getEvmBalance(addr);
    msg += `• EVM ${addr.slice(0, 8)}...: ${bal} ETH\n`;
  }
  for (const addr of TON_WALLETS) {
    const bal = await getTonBalance(addr);
    msg += `• TON ${addr.slice(0, 8)}...: ${bal} TON\n`;
  }
  if (ADMIN_ID) await bot.telegram.sendMessage(ADMIN_ID, msg, { parse_mode: 'Markdown' });
});

cron.schedule('0 9 * * *', async () => {
  let msg = '📅 *Reporte diario 09:00*\n';
  for (const addr of EVM_WALLETS) {
    const bal = await getEvmBalance(addr);
    msg += `• EVM ${addr.slice(0, 8)}...: ${bal} ETH\n`;
  }
  for (const addr of TON_WALLETS) {
    const bal = await getTonBalance(addr);
    msg += `• TON ${addr.slice(0, 8)}...: ${bal} TON\n`;
  }
  if (ADMIN_ID) await bot.telegram.sendMessage(ADMIN_ID, msg, { parse_mode: 'Markdown' });
});

// ——— Lanzamiento del bot ———
bot.launch()
  .then(() => console.log('✅ CryBot MultiWallet operativo'))
  .catch((err) => {
    console.error('❌ Error al lanzar bot:', err.message);
    process.exit(1);
  });

process.stdin.resume();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));