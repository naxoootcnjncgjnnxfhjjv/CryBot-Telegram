import { loadConfig } from './config.js';

const config = loadConfig();
const errors = [];
const warnings = [];

if (!config.botToken) {
  errors.push('BOT_TOKEN or TELEGRAM_BOT_TOKEN is required');
}

if (!config.baseUrl) {
  warnings.push('BASE_URL is empty; webhook will not be configured automatically');
}

if (!config.dryRun && !config.enableWriteActions) {
  warnings.push('DRY_RUN is disabled but ENABLE_WRITE_ACTIONS is false; write actions remain blocked');
}

if (config.enableWriteActions && config.dryRun) {
  warnings.push('ENABLE_WRITE_ACTIONS is true but DRY_RUN is also true; dry-run should still prevent irreversible actions');
}

const walletCount = config.wallets.ton.length + config.wallets.evm.length + config.wallets.aptos.length;

if (walletCount === 0) {
  warnings.push('No wallets configured in TON_WALLETS, EVM_WALLETS or APTOS_WALLETS');
}

for (const warning of warnings) {
  console.warn(`[runtime:warning] ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[runtime:error] ${error}`);
  }
  process.exit(1);
}

console.log('[runtime:ok] CryBot runtime configuration is valid');
