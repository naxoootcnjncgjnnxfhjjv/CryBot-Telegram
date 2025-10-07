// index.js
// npm i telegraf axios
const { Telegraf } = require('telegraf');
const axios = require('axios');

if (!process.env.BOT_TOKEN) throw new Error('Falta BOT_TOKEN en variables de entorno');
const bot = new Telegraf(process.env.BOT_TOKEN);

// --- Helpers ---
const isEvmAddress = (s) => /^0x[0-9a-fA-F]{40}$/.test(s);
const NORMALIZE = {
  eth: 'eth', ethereum: 'eth', mainnet: 'eth',
  polygon: 'polygon', matic: 'polygon', pol: 'polygon',
  bsc: 'bsc', bnb: 'bsc', binance: 'bsc'
};
const CHAINS = {
  eth:    { label: 'Ethereum',        baseUrl: 'https://api.etherscan.io/api',     envKey: 'ETHERSCAN_API_KEY',   symbol: 'ETH',  decimals: 18 },
  polygon:{ label: 'Polygon',         baseUrl: 'https://api.polygonscan.com/api',  envKey: 'POLYGONSCAN_API_KEY', symbol: 'MATIC',decimals: 18 },
  bsc:    { label: 'BNB Smart Chain', baseUrl: 'https://api.bscscan.com/api',      envKey: 'BSCSCAN_API_KEY',     symbol: 'BNB',  decimals: 18 },
};
function formatUnitsBigInt(weiStr, decimals = 18, dp = 6) {
  const wei = BigInt(weiStr);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = wei / base;
  const frac  = wei % base;
  const fracStr = (base + frac).toString().slice(1).padStart(decimals, '0').slice(0, dp);
  return `${whole.toString()}.${fracStr}`.replace(/\.$/, '');
}
async function getScanBalance(chainKey, address) {
  const cfg = CHAINS[chainKey];
  if (!cfg) throw new Error('chain-no-soportada');

  const apiKey = process.env[cfg.envKey];
  if (!apiKey) throw new Error(`Falta la variable de entorno ${cfg.envKey}`);

  const url = `${cfg.baseUrl}?module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`;

  // retry simple por rate limit
  for (let i = 0; i < 2; i++) {
    const { data } = await axios.get(url, { timeout: 15000 });
    if (data?.status === '1') {
      return {
        balanceStr: data.result,
        symbol: cfg.symbol,
        label: cfg.label,
        decimals: cfg.decimals,
      };
    }
    const msg = (data?.message || '').toUpperCase();
    if (msg.includes('RATE')) { await new Promise(r => setTimeout(r, 1200)); continue; }
    throw new Error(`API error: ${data?.message || 'Respuesta inválida'}`);
  }
  throw new Error('API error: rate limit');
}

// --- Comandos ---
bot.start((ctx) => ctx.reply('✅ CryBot listo. Usa /saldo <walletEVM> [eth|polygon|bsc]'));
bot.command('ping', (ctx) => ctx.reply('pong'));

bot.command('saldo', async (ctx) => {
  try {
    const parts = ctx.message.text.trim().split(/\s+/);
    const wallet = parts[1];
    const rawChain = (parts[2] || 'eth').toLowerCase();
    const chain = NORMALIZE[rawChain] || 'eth';

    if (!wallet || !isEvmAddress(wallet)) {
      return ctx.reply('⚠️ Uso: /saldo <walletEVM> [eth|polygon|bsc]');
    }

    const { balanceStr, symbol, label, decimals } = await getScanBalance(chain, wallet);
    const pretty = formatUnitsBigInt(balanceStr, decimals, 6);
    const short = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;

    return ctx.reply(`💰 ${label}\n${short}\n${pretty} ${symbol}`);
  } catch (err) {
    console.error('[saldo]', err);
    return ctx.reply(`⚠️ Error al consultar el saldo ${err?.message ? '('+err.message+')' : ''}`);
  }
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
bot.launch().then(() => console.log('🤖 Bot lanzado'));