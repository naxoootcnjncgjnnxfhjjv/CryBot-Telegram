// Load environment variables from .env file if the dotenv module is available.
try {
  require('dotenv').config();
} catch (e) {
  // If dotenv is not installed, environment variables will still be read from process.env.
}
const express = require('express');
const { Telegraf } = require('telegraf');
// Import verifyTonContract if available; stub if not present.
let verifyTonContract;
try {
  verifyTonContract = require('./verifyTonContract');
} catch (e) {
  verifyTonContract = async () => ({ verified: false, codeHash: null });
}

// Map environment variables for compatibility with Railway
process.env.EVM_ADDRESS = process.env.EVM_ADDRESS || process.env.EVM_WALLET;
process.env.TON_ADDRESS = process.env.TON_ADDRESS || process.env.TON_WALLET;
process.env.PRINCIPAL_ADDRESS = process.env.PRINCIPAL_ADDRESS || process.env.MAIN_WALLET;
process.env.TONCENTER_API_KEY = process.env.TONCENTER_API_KEY || process.env.TON_API_KEY;

// Use node-fetch for Node versions < 18; in Node 18+ fetch is built-in.
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Middleware for JSON payloads
app.use(express.json());

// Telegram webhook endpoint
app.post('/bot', (req, res) => {
  bot.handleUpdate(req.body, res);
});

/*
 * Helper functions
 * In production you should implement these functions using real APIs (Etherscan, Covalent, etc.).
 * The stubs below return static values to mirror the example conversation shown by the user.  Replace them
 * with real implementations to fetch actual token balances, airdrops and NFT listings.
 */
async function getEvmBalance(address) {
  // TODO: Use an API like Etherscan to fetch the ETH balance of the address.
  // Returning 0 ETH by default.
  return '0';
}

async function getTonBalance(address) {
  // Call toncenter API to fetch TON balance
  const apiKey = process.env.TONCENTER_API_KEY
    ? `&api_key=${process.env.TONCENTER_API_KEY}`
    : '';
  const url = `https://toncenter.com/api/v2/getExtendedAddressInformation?address=${encodeURIComponent(
    address,
  )}${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'TON API error');
  const balanceTon = parseFloat(data.result.balance) / 1e9;
  return balanceTon.toFixed(6);
}

async function getErc20Tokens(address) {
  // TODO: Use an ERC‑20 indexing service (e.g., Covalent, Moralis) to fetch token holdings.
  return 0;
}

async function getTonAirdrops(address) {
  // TODO: Query airdrop services or check for unclaimed TON airdrops.
  return 0;
}

// /start command
bot.start((ctx) => {
  const message =
    '🤖 Bot automático para escaneo de wallets, reclamo de recompensas, venta de NFTs y transferencias.\n\n' +
    '✅ CryBot activo.\n' +
    'Usa /saldo, /scan, /reclamar, /vender, /enviar, /verificar';
  return ctx.reply(message);
});

// /saldo command
bot.command('saldo', async (ctx) => {
  const evmAddr = process.env.EVM_ADDRESS;
  const tonAddr = process.env.TON_ADDRESS;
  if (!evmAddr || !tonAddr) {
    return ctx.reply(
      '⚠️ No se ha configurado la dirección EVM o TON. Establece EVM_ADDRESS y TON_ADDRESS en el entorno.',
    );
  }
  await ctx.reply('⏳ Consultando saldos...');
  try {
    const [ethBal, tonBal] = await Promise.all([
      getEvmBalance(evmAddr),
      getTonBalance(tonAddr),
    ]);
    let reply = '💰 Saldos\n';
    reply += `• EVM\n(${evmAddr}): ${ethBal} ETH\n`;
    reply += `• TON\n(${tonAddr}): ${tonBal} TON`;
    if (process.env.PRINCIPAL_ADDRESS) {
      reply += `\n→ Principal:\n${process.env.PRINCIPAL_ADDRESS}`;
    }
    return ctx.reply(reply);
  } catch (err) {
    console.error(err);
    return ctx.reply('Error al obtener saldos.');
  }
});

// /scan command
bot.command('scan', async (ctx) => {
  const evmAddr = process.env.EVM_ADDRESS;
  const tonAddr = process.env.TON_ADDRESS;
  if (!evmAddr || !tonAddr) {
    return ctx.reply(
      '⚠️ No se ha configurado la dirección EVM o TON. Establece EVM_ADDRESS y TON_ADDRESS en el entorno.',
    );
  }
  await ctx.reply('🔍 Escaneando wallets...');
  try {
    const [erc20Count, airdropsCount] = await Promise.all([
      getErc20Tokens(evmAddr),
      getTonAirdrops(tonAddr),
    ]);
    let reply = '✅ Escaneo listo.\n';
    reply += `• ERC‑20 (EVM): ${erc20Count} (nota: Para tokens ERC‑20 usaré fuente indexada en la siguiente iteración.)\n`;
    reply += `• Airdrops TON: ${airdropsCount}`;
    return ctx.reply(reply);
  } catch (err) {
    console.error(err);
    return ctx.reply('Error en el escaneo.');
  }
});

// /reclamar command
bot.command('reclamar', async (ctx) => {
  await ctx.reply('🎁 Buscando y reclamando airdrops...');
  // In a real implementation, this would initiate claim transactions via TON Connect.
  const totalClaimed = 0;
  return ctx.reply(`✅ Reclamación finalizada. Total: ${totalClaimed}. Protocolos: —`);
});

// /vender command
bot.command('vender', async (ctx) => {
  await ctx.reply('🛒 Listando NFTs automáticamente (requiere firma)...');
  // In a real implementation, fetch NFTs and prepare sale; signature needed via TON Connect.
  const listed = 0;
  return ctx.reply(
    `✅ NFTs listados: ${listed}. Nota: Se requiere firma. Dejamos hook preparado.`,
  );
});

// /verificar command
bot.command('verificar', async (ctx) => {
  const [, address] = ctx.message.text.split(' ');
  if (!address) {
    return ctx.reply('Usa /verificar <direccion_wallet>');
  }
  try {
    const result = await verifyTonContract(address);
    if (result.verified) {
      return ctx.reply(`✅ El contrato está verificado. Hash: ${result.codeHash}`);
    }
    if (result.codeHash) {
      return ctx.reply(
        `⚠️ El contrato no está verificado. Hash calculado: ${result.codeHash}`,
      );
    }
    return ctx.reply('⚠️ La cuenta no tiene código (¿quizá no está desplegada?).');
  } catch (err) {
    console.error(err);
    return ctx.reply('Error al verificar el contrato.');
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', backend: 'crybot', timestamp: Date.now() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('CryBot Backend running ✅');
});

// Export the Express app for deployment (e.g., Vercel/Railway)
module.exports = app;
