require('dotenv').config();

function list(name) {
  return (process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function number(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadConfig() {
  return {
    botToken: process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
    port: number('PORT', 3000),
    webhookPath: process.env.WEBHOOK_PATH || '/webhook',
    baseUrl: process.env.BASE_URL || process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    tonApiKey: process.env.TON_API_KEY || process.env.TONAPI_KEY || '',
    etherscanApiKey: process.env.ETHERSCAN_API_KEY || '',
    rpcUrl: process.env.RPC_URL || '',
    mainWallet: process.env.MAIN_WALLET || '',
    pollInterval: number('POLL_INTERVAL', 5 * 60 * 1000),
    wallets: {
      ton: list('TON_WALLETS'),
      evm: list('EVM_WALLETS'),
      aptos: list('APTOS_WALLETS')
    },
    flags: {
      autoAcceptOffers: process.env.AUTO_ACCEPT_OFFERS === 'true',
      enableWriteActions: process.env.ENABLE_WRITE_ACTIONS === 'true'
    }
  };
}

function assertConfig(config = loadConfig()) {
  if (!config.botToken) {
    throw new Error('Missing BOT_TOKEN or TELEGRAM_BOT_TOKEN');
  }
  return config;
}

const config = loadConfig();

module.exports = {
  ...config,
  config,
  loadConfig,
  assertConfig
};
