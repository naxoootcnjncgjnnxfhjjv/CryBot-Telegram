// config.js
// Configuración mínima para CryBot-Telegram
export function loadConfig() {
  return {
    rpcUrl: process.env.RPC_URL || "https://ethereum.publicnode.com",
    privateKey: process.env.PRIVATE_KEY_EVM,
    botToken: process.env.BOT_TOKEN,
    adminId: process.env.ADMIN_TELEGRAM_ID,
  };
}