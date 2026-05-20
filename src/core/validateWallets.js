import { loadConfig } from './config.js';

const config = loadConfig();

function fail(message) {
  console.error(`[validateWallets] ${message}`);
  process.exit(1);
}

if (!Array.isArray(config.wallets.ton) || config.wallets.ton.length < 1) {
  fail('TON wallet inventory is empty');
}

if (!Array.isArray(config.wallets.evm) || config.wallets.evm.length < 1) {
  fail('EVM wallet inventory is empty');
}

if (!Array.isArray(config.wallets.aptos) || config.wallets.aptos.length < 1) {
  fail('Aptos wallet inventory is empty');
}

const duplicates = [];
for (const [chain, wallets] of Object.entries(config.wallets)) {
  const seen = new Set();
  for (const wallet of wallets) {
    if (seen.has(wallet)) duplicates.push(`${chain}:${wallet}`);
    seen.add(wallet);
  }
}

if (duplicates.length > 0) {
  fail(`Duplicate wallets found: ${duplicates.join(', ')}`);
}

console.log(JSON.stringify({
  ok: true,
  ton: config.wallets.ton.length,
  evm: config.wallets.evm.length,
  aptos: config.wallets.aptos.length
}));
