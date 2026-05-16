import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { getWalletInventorySummary } from '../services/walletInventory.js';

function scanOnce() {
  const wallets = getWalletInventorySummary(config);

  logger.info('scanner_run', {
    walletCount: wallets.length,
    dryRun: config.dryRun,
    writeActions: config.enableWriteActions
  });

  for (const wallet of wallets) {
    logger.info('scanner_wallet_seen', {
      chain: wallet.chain,
      address: wallet.address
    });
  }

  return wallets;
}

scanOnce();

if (process.env.SCANNER_LOOP === 'true') {
  setInterval(scanOnce, config.scanIntervalMs);
}
