import fs from 'node:fs/promises';
import { config } from '../core/config.js';
import { getWalletInventorySummary } from './walletInventory.js';

const outputPath = process.argv[2] || 'wallet-manifest.json';
const wallets = getWalletInventorySummary(config);
const manifest = {
  generatedAt: new Date().toISOString(),
  dryRun: config.dryRun,
  writeActions: config.enableWriteActions,
  counts: {
    total: wallets.length,
    ton: config.wallets.ton.length,
    evm: config.wallets.evm.length,
    aptos: config.wallets.aptos.length
  },
  wallets
};

await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest.counts));
