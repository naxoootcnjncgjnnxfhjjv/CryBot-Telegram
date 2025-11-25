/*
 * Global configuration for CryBot
 *
 * Sensitive settings like API keys and wallet addresses should be
 * provided via environment variables when deploying to production.
 * The defaults here are placeholders to help with local testing.
 */

module.exports = {
  // Telegram bot token. Required.
  BOT_TOKEN: process.env.BOT_TOKEN || '7461419771:AAFms0nWyzBkaEQC6HcObqv37avnA8D4MY4',
  // TON and EVM API keys for scanning balances and NFTs.
  TON_API_KEY: process.env.TON_API_KEY || 'YOUR_TON_API_KEY',
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || 'YOUR_ETHERSCAN_API_KEY',
  // Comma‑separated list of wallets to monitor for each network. These
  // addresses can also be provided as JSON arrays via environment vars.
  TON_WALLETS: process.env.TON_WALLETS
    ? process.env.TON_WALLETS.split(',').map(a => a.trim()).filter(Boolean)
    : [],
  EVM_WALLETS: process.env.EVM_WALLETS
    ? process.env.EVM_WALLETS.split(',').map(a => a.trim()).filter(Boolean)
    : [],
  // Gas price override for EVM network transactions (wei). Leave
  // undefined to let the provider decide.
  GAS_PRICE: process.env.GAS_PRICE ? Number(process.env.GAS_PRICE) : undefined,
  // Polling intervals (in milliseconds) for background tasks.
  POLL_INTERVAL: process.env.POLL_INTERVAL ? Number(process.env.POLL_INTERVAL) : 5 * 60 * 1000,
};
