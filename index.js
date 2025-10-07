// index.js
// npm i telegraf axios

const { Telegraf } = require('telegraf');
const axios = require('axios');
const http = require('http');

// ==== ENV ====
const {
  BOT_TOKEN,
  ETHERSCAN_API_KEY,
  POLYGONSCAN_API_KEY,
  BSCSCAN_API_KEY,
  ARBISCAN_API_KEY,
  BASESCAN_API_KEY,
  SNOWTRACE_API_KEY,
  TON_API_KEY,
  TELEGRAM_ADMIN_ID,
  ALLOWED_USERNAMES,
  LOG_LEVEL = 'info',
  PORT = 3000,
  USE_POLLING = 'true',
  TZ = 'Europe/Madrid'
} = process.env;

if (!BOT_TOKEN) throw new Error('Falta BOT_TOKEN');
if (!ETHERSCAN_API_KEY) console.warn('⚠️ Falta ETHERSCAN_API_KEY (solo Ethereum).');

// ==== BOT ====
const bot = new Telegraf(BOT_TOKEN);

// ==== ACCESS CONTROL (opcional) ====
const allowedUsernames = (ALLOWED_USERNAMES || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

bot.use(async (ctx, next) => {
  const uname = (ctx.from?.username || '').toLowerCase();
  const uid = String(ctx.from?.id || '');
  const whitelisted =
    (allowedUsernames.length === 0 || allowedUsernames.includes(uname)) &&
    (!TELEGRAM_ADMIN_ID || TELEGRAM_ADMIN_ID === uid);

  if (!whitelisted) {
    return ctx.reply('⛔ Acceso restringido.');
  }
  return next();
});

// ==== HELPERS ====
const fmt = (n, decimals = 6) =>
  Number(n).toLocaleString('es-ES', { maximumFractionDigits: decimals });

const toEth = (wei) => Number(wei) / 1e18;
const toTon = (nanoton) => Number(nanoton) / 1e9;

const isEvm = (s) => /^0x[0-9a-fA-F]{40}$/.test(s);
const isTon = (s) => /^[EU]Q[A-Za-z0-9_-]{48}$/.test(s) || /^[TU][A-Za-z0-9_-]{30,66}$/.test(s);

// Map genérico para explorers tipo *scan
const CHAINS = {
  eth: {
    label: 'Ethereum',
    symbol: 'ETH',
    baseUrl: 'https://api.etherscan.io/api',
    envKey: 'ETHERSCAN_API_KEY',
    key: ETHERSCAN_API_KEY
  },
  polygon: {
    label: 'Polygon',
    symbol: 'MATIC',
    baseUrl: 'https://api.polygonscan.com/api',
    envKey: 'POLYGONSCAN_API_KEY',
    key: POLYGONSCAN_API_KEY
  },
  bsc: {
    label: 'BSC',
    symbol: 'BNB',
    baseUrl: 'https://api.bscscan.com/api',
    envKey: 'BSCSCAN_API_KEY',
    key: BSCSCAN_API_KEY
  },
  arb: {
    label: 'Arbitrum',
    symbol: 'ETH',
    baseUrl: 'https://api.arbiscan.io/api',
    envKey: 'ARBISCAN_API_KEY',
    key: ARBISCAN_API_KEY
  },
  base: {
    label: 'Base',
    symbol: 'ETH',
    baseUrl: 'https://api.basescan.org/api',
    envKey: 'BASESCAN_API_KEY',
    key: BASESCAN_API_KEY
  },
  avax: {
    label: 'Avalanche',
    symbol: 'AVAX',
    baseUrl: 'https://api.snowtrace.io/api',
    envKey: 'SNOWTRACE_API_KEY',
    key: SNOWTRACE_API_KEY
  }
};

// ==== EVM balance (nativo) ====
async function evmNativeBalance(chainKey, address) {
  const chain = CHAINS[chainKey];
  if (!chain || !chain.key) {
    throw new Error(`La red ${chainKey} no está configurada (${chain?.envKey} faltante).`);
  }

  const url = `${chain.baseUrl}?module=account&action=balance&address=${address}&tag=latest&apikey=${chain.key}`;
  const { data } = await axios.get(url, { timeout: 15000 });

  if (!data || data.status === '0') {
    throw new Error(data?.message || 'Respuesta inválida del explorer');
  }
  const eth = toEth(data.result);
  return { chain: chain.label, symbol: chain.symbol, amount: eth };
}

// ==== TON (balance y jettons) ====
const TONAPI = axios.create({
  baseURL: 'https://tonapi.io/v2',
  timeout: 15000,
  headers: TON_API_KEY ? { Authorization: `Bearer ${TON_API_KEY}` } : {}
});

async function tonBalance(address) {
  if (!TON_API_KEY) throw new Error('Falta TON_API_KEY');
  const { data } = await TONAPI.get(`/accounts/${address}`);
  return toTon(data.balance || 0);
}

async function tonJettons(address) {
  if (!TON_API_KEY) throw new Error('Falta TON_API_KEY');
  const { data } = await TONAPI.get(`/accounts/${address}/jettons`);
  const list = (data?.balances || []).map(j => {
    const meta = j.jetton?.metadata || {};
    const sym = meta.symbol || 'JETTON';
    const dec = Number(meta.decimals || 9);
    const amt = Number(j.balance || 0) / 10 ** dec;
    return { symbol: sym, amount: amt, name: meta.name || sym };
  });
  // orden por monto desc
  return list.sort((a, b) => b.amount - a.amount).slice(0, 15);
}

// ==== COMANDOS ====
bot.start((ctx) =>
  ctx.reply(
    [
      '🤖 CryBot listo.',
      'Comandos:',
      '• /saldo <chain> <0xaddr>  — ETH/MATIC/BNB según red',
      '   chains: eth | polygon | bsc | arb | base | avax',
      '• /ton <addrTON>          — saldo TON',
      '• /tokens <addrTON>       — jettons (top 15)',
      '',
      'Ejemplos:',
      '/saldo eth 0x7B9F...B09',
      '/ton UQChtGxrxo1H74kGde0GNsSKWYG_rhGMKNco-opmWQ1B-yil',
      '/tokens UQChtGxrxo1H74kGde0GNsSKWYG_rhGMKNco-opmWQ1B-yil'
    ].join('\n')
  )
);

bot.command('saldo', async (ctx) => {
  try {
    const parts = (ctx.message.text || '').trim().split(/\s+/);
    // /saldo <chain> <address>
    if (parts.length < 3) {
      return ctx.reply('Uso: /saldo <eth|polygon|bsc|arb|base|avax> <0xaddress>');
    }
    const chainKey = parts[1].toLowerCase();
    const address = parts[2].trim();

    if (!isEvm(address)) return ctx.reply('Dirección EVM inválida (debe empezar por 0x...).');

    const res = await evmNativeBalance(chainKey, address);
    return ctx.reply(`💰 ${res.chain}: ${fmt(res.amount)} ${res.symbol}\n(${address})`);
  } catch (e) {
    console.error(e);
    return ctx.reply(`❌ Error en /saldo: ${e.message}`);
  }
});

bot.command('ton', async (ctx) => {
  try {
    const parts = (ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 2) return ctx.reply('Uso: /ton <direccionTON>');
    const addr = parts[1].trim();
    if (!isTon(addr)) return ctx.reply('Dirección TON inválida.');
    const ton = await tonBalance(addr);
    return ctx.reply(`💎 TON: ${fmt(ton, 6)} TON\n(${addr})`);
  } catch (e) {
    console.error(e);
    return ctx.reply(`❌ Error en /ton: ${e.message}`);
  }
});

bot.command('tokens', async (ctx) => {
  try {
    const parts = (ctx.message.text || '').trim().split(/\s+/);
    if (parts.length < 2) return ctx.reply('Uso: /tokens <direccionTON>');
    const addr = parts[1].trim();
    if (!isTon(addr)) return ctx.reply('Dirección TON inválida.');

    const list = await tonJettons(addr);
    if (list.length === 0) return ctx.reply('📭 Sin jettons detectados.');

    const lines = list.map((j, i) => `${i + 1}. ${j.symbol}: ${fmt(j.amount)}`);
    return ctx.reply(['🪙 Jettons (top 15):', ...lines, `\n(${addr})`].join('\n'));
  } catch (e) {
    console.error(e);
    return ctx.reply(`❌ Error en /tokens: ${e.message}`);
  }
});

// ==== Arranque ====
(async () => {
  // tiny keep-alive server (útil en Railway)
  http
    .createServer((_, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    })
    .listen(Number(PORT));

  if (USE_POLLING === 'true') {
    await bot.launch();
    console.log('🤖 Bot iniciado con polling.');
  } else {
    console.log('⚠️ USE_POLLING=false: configura webhooks antes de lanzar.');
    await bot.launch(); // igualmente lanzamos, pero se recomienda polling para Railway free
  }

  // Cierre limpio
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
})();