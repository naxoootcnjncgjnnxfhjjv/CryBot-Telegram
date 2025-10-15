// index.js — Versión mejorada de CRYBOT-TELEGRAM

const { Telegraf } = require('telegraf');
const axios = require('axios');
const { ethers } = require('ethers');
const cron = require('node-cron');

// ——— Configuración (entornos) ———
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_TELEGRAM_ID || '');
const EV_WALLET = process.env.EV_WALLET || null;
const TON_WALLET = process.env.TON_WALLET || null;
const MAIN_WALLET = process.env.MAIN_WALLET || null;
const RPC_URL = process.env.RPC_URL || 'https://ethereum.publicnode.com';

if (!BOT_TOKEN) {
  console.error('❌ ERROR: BOT_TOKEN no está definido');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ——— EVM provider y wallet ———
const provider = new ethers.JsonRpcProvider(RPC_URL);
let wallet = null;
if (process.env.PRIVATE_KEY_EVM) {
  try {
    wallet = new ethers.Wallet(process.env.PRIVATE_KEY_EVM, provider);
  } catch (err) {
    console.error('❌ PRIVATE_KEY_EVM inválida:', err.message);
  }
}

// ——— Utilidades / helpers ———

const isAdmin = (ctx) => String(ctx.from?.id) === ADMIN_ID;

async function scanEvm(addr) {
  if (!addr) return null;
  try {
    const bal = await provider.getBalance(addr);
    return {
      address: addr,
      eth: Number(ethers.formatEther(bal))
    };
  } catch (err) {
    console.error('scanEvm error:', err.message);
    return { address: addr, error: err.message };
  }
}

async function scanTon(addr) {
  if (!addr) return null;
  // Aquí integrar tu API de TON
  return { address: addr, ton: 'pendiente' };
}

async function claimAirdropsForAll() {
  // Ejemplo: placeholder. Debes rellenar según tus integraciones.
  console.log('🔁 Ejecutando claimAirdropsForAll (stub)');
  return { claimed: [] };
}

// ——— Comandos de Telegram ———
bot.start((ctx) => ctx.reply('Hola, CryBot activo. Usa /help'));

bot.command('help', (ctx) => {
  ctx.reply([
    '/status — test de vida',
    '/saldo — ver balances EVM / TON',
    '/reclamar — ejecutar airdrops (solo admin)',
    '/enviar <amtETH> <to> — enviar ETH (solo admin)'
  ].join('\n'));
});

bot.command('status', (ctx) => {
  ctx.reply('OK');
});

bot.command('saldo', async (ctx) => {
  const evm = await scanEvm(EV_WALLET);
  const ton = await scanTon(TON_WALLET);
  ctx.reply(`Balances:\nEVM: ${JSON.stringify(evm)}\nTON: ${JSON.stringify(ton)}`);
});

bot.command('reclamar', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('❌ No autorizado');
  }
  try {
    const res = await claimAirdropsForAll();
    ctx.reply(`✅ Reclamos: ${JSON.stringify(res)}`);
  } catch (err) {
    console.error('Error en /reclamar:', err.message);
    ctx.reply(`❌ Error en reclamar: ${err.message}`);
  }
});

bot.command('enviar', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('❌ No autorizado');
  }
  if (!wallet) {
    return ctx.reply('❌ No hay PRIVATE_KEY_EVM disponible');
  }
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 3) {
    return ctx.reply('Uso: /enviar <amountETH> <to>');
  }
  const amount = parts[1];
  const to = parts[2];
  try {
    const tx = await wallet.sendTransaction({
      to,
      value: ethers.parseEther(amount)
    });
    ctx.reply(`✅ Enviando: ${tx.hash}`);
  } catch (err) {
    console.error('Error en /enviar:', err.message);
    ctx.reply(`❌ Error al enviar: ${err.message}`);
  }
});

// ——— Tareas programadas ———
// Escaneo automático cada 5 minutos
setInterval(async () => {
  try {
    const evm = await scanEvm(EV_WALLET);
    const ton = await scanTon(TON_WALLET);
    if (ADMIN_ID) {
      await bot.telegram.sendMessage(ADMIN_ID, `📊 Scan automático:\nEVM: ${JSON.stringify(evm)}\nTON: ${JSON.stringify(ton)}`);
    }
  } catch (err) {
    console.error('Error en escaneo periódico:', err.message);
  }
}, 5 * 60 * 1000);

// Reporte diario a las 09:00
cron.schedule('0 9 * * *', async () => {
  try {
    const evm = await scanEvm(EV_WALLET);
    const ton = await scanTon(TON_WALLET);
    if (ADMIN_ID) {
      await bot.telegram.sendMessage(ADMIN_ID, `📅 Reporte diario:\nEVM: ${JSON.stringify(evm)}\nTON: ${JSON.stringify(ton)}`);
    }
  } catch (err) {
    console.error('Error en reporte diario:', err.message);
  }
});

// ——— Lanzamiento del bot & mantener vivo ———
bot.launch()
  .then(() => console.log('✅ Bot lanzado (polling)'))
  .catch((err) => {
    console.error('❌ Error al lanzar bot:', err.message);
    process.exit(1);
  });

// Evitar que el contenedor se cierre
process.stdin.resume();

// Finalizar limpio
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
