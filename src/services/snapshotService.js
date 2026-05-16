import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function saveInventorySnapshot(wallets) {
  mkdirSync('storage', { recursive: true });

  const snapshot = {
    timestamp: new Date().toISOString(),
    walletCount: wallets.length,
    wallets
  };

  const file = join('storage', 'inventory-snapshot.json');

  writeFileSync(file, JSON.stringify(snapshot, null, 2));

  return file;
}
