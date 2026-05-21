import 'dotenv/config';
import { mergeConfiguredWallets } from './defaultWallets.js';

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

function bool(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export function loadConfig() {
  const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || '';
  const baseUrl = process.env.BASE_URL || (publicDomain ? `https://${publicDomain.replace(/^https?:\/\//, '')}` : '');
  const configuredWallets = {
    ton: list('TON_WALLETS'),
    evm: list('EVM_WALLETS'),
    aptos: list('APTOS_WALLETS')
  };

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: number('PORT', 3000),
    botToken: process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
    adminTelegramId: process.env.ADMIN_TELEGRAM_ID || '',
    baseUrl,
    webhookPath: process.env.WEBHOOK_PATH || '/webhook',
    dryRun: bool('DRY_RUN', true),
    enableWriteActions: bool('ENABLE_WRITE_ACTIONS', false),
    requireBotToken: bool('REQUIRE_BOT_TOKEN', false),
    scanIntervalMs: number('SCAN_INTERVAL_MS', 5 * 60 * 1000),
    tonApiKey: process.env.TONAPI_KEY || process.env.TON_API_KEY || '',
    etherscanApiKey: process.env.ETHERSCAN_API_KEY || '',
    rpcUrl: process.env.RPC_URL || 'https://ethereum.publicnode.com',
    destinationWallet: process.env.MAIN_WALLET || process.env.DESTINATION_WALLET || '',
    wallets: mergeConfiguredWallets(configuredWallets)
  };
}

export function assertRuntimeConfig(config = loadConfig()) {
  if (config.requireBotToken && !config.botToken) {
    throw new Error('Missing BOT_TOKEN or TELEGRAM_BOT_TOKEN');
  }
  return config;
}

export const config = loadConfig();
