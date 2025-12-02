/*
 * Configuración global segura para CryBot
 * NO guarda claves en el código.
 * TODO viene desde variables de entorno en Railway.
 */

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  TON_API_KEY: process.env.TON_API_KEY,
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY,

  TON_WALLETS: process.env.TON_WALLETS
    ? process.env.TON_WALLETS.split(',').map(a => a.trim()).filter(Boolean)
    : [],

  EVM_WALLETS: process.env.EVM_WALLETS
    ? process.env.EVM_WALLETS.split(',').map(a => a.trim()).filter(Boolean)
    : [],

  GAS_PRICE: process.env.GAS_PRICE ? Number(process.env.GAS_PRICE) : undefined,

  POLL_INTERVAL: process.env.POLL_INTERVAL
    ? Number(process.env.POLL_INTERVAL)
    : 5 * 60 * 1000, // 5 minutos por defecto

  MAIN_WALLET: process.env.MAIN_WALLET,
  RPC_URL: process.env.RPC_URL,

  PRIVATE_KEY_7B9F: process.env.PRIVATE_KEY_7B9F,

  TON_WALLET_SEED: process.env.TON_WALLET_SEED,
};