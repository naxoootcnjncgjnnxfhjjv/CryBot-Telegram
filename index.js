// Requiere: telegraf y axios
// npm i telegraf axios
const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- Helpers ---
const isEvmAddress = (s) => /^0x[0-9a-fA-F]{40}$/.test(s);

const CHAINS = {
  eth: {
    label: 'Ethereum',
    baseUrl: 'https://api.etherscan.io/api',
    envKey: 'ETHERSCAN_API_KEY',
    symbol: 'ETH'
  },
  polygon: {
    label: 'Polygon',
    baseUrl: 'https://api.polygonscan.com/api',
    envKey: 'POLYGONSCAN_API_KEY',
    symbol: 'MATIC'
  },
  bsc: {
    label: 'BNB Smart Chain',
    baseUrl: 'https://api.bscscan.com/api',
    envKey: 'BSCSCAN_API_KEY',
    symbol: 'BNB'
  }
};

// alias aceptados
const NORMALIZE = {
  eth: 'eth', ethereum: 'eth', mainnet: 'eth',
  polygon: 'polygon', matic: 'polygon', mumbai: 'polygon', pol: 'polygon',
  bsc: 'bsc', bnb: 'bsc', binance: 'bsc'
};

async function getScanBalance(chainKey, address) {
  const cfg = CHAINS[chainKey];
  if (!cfg) throw new Error('chain-no-soportada');

  const apiKey = process.env[cfg.envKey];
  if (!apiKey) {
    throw new Error(`Falta la variable de entorno ${cfg.envKey}`);
  }

  const url = `${cfg.baseUrl}?module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`;
  const { data } = await axios.get(url, { timeout: 15000 });

  if (!data || data.status !== '1') {
    const msg = data && data.message ? data.message : 'Respuesta inválida';
    throw new Error(`API error: ${msg}`);
  }

  // wei -> unidad nativa
  const balance = Number(data.result) / 1e18;
  return { balance, symbol: cfg.symbol, label: cfg.label };
}

// --- /saldo <wallet> [red] ---
bot.command('saldo', async (ctx) => {
  try {
    const parts = ctx.message.text.trim().split(/\s+/);
    const wallet = parts[1];
    const rawChain = (parts[2] || 'eth').toLowerCase();
    const chain = NORMALIZE[rawChain] || 'eth';

    if (!wallet || !isEvmAddress(wallet)) {
      return ctx.reply('⚠️ Uso: /saldo <walletEVM> [eth|polygon|bsc]');
    }

    const { balance, symbol, label } = await getScanBalance(chain, wallet);
    const short = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;

    return ctx.reply(`💰 ${label}\n${short}\n${balance.toFixed(6)} ${symbol}`);
  } catch (err) {
    console.error('[saldo]', err?.message || err);
    return ctx.reply(`⚠️ Error al consultar el saldo. ${err?.message ? '('+err.message+')' : ''}`);
  }
});

bot.launch();