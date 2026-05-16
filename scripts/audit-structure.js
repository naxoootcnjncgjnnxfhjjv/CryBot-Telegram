import { existsSync } from 'node:fs';

const requiredPaths = [
  'src/index.js',
  'src/core/config.js',
  'src/core/logger.js',
  'src/core/runtimeInfo.js',
  'src/core/validateRuntime.js',
  'src/bot/registerCommands.js',
  'src/services/walletInventory.js',
  'src/services/balanceScanner.js',
  'src/workers/scanner.js',
  'src/chains/evm.js',
  'src/chains/ton.js',
  'src/chains/aptos.js',
  'README.md',
  'ARCHITECTURE.md',
  'DEPLOYMENT.md',
  '.env.example',
  '.github/workflows/ci.yml'
];

const legacyPaths = [
  'server-express.js',
  'improved_index.js',
  'config.js'
];

let failed = false;

for (const path of requiredPaths) {
  if (!existsSync(path)) {
    console.error(`[audit:error] Missing required path: ${path}`);
    failed = true;
  }
}

for (const path of legacyPaths) {
  if (existsSync(path)) {
    console.warn(`[audit:warning] Legacy path still present: ${path}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log('[audit:ok] Repository structure audit completed');
