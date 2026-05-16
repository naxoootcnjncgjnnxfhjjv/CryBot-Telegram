export function getWalletInventorySummary(config) {
  const ton = config.wallets.ton.map((address) => ({ chain: 'TON', address }));
  const evm = config.wallets.evm.map((address) => ({ chain: 'EVM', address }));
  const aptos = config.wallets.aptos.map((address) => ({ chain: 'APTOS', address }));

  return [...ton, ...evm, ...aptos];
}

export function formatWalletInventory(config) {
  const wallets = getWalletInventorySummary(config);

  if (wallets.length === 0) {
    return 'No wallets configured. Set TON_WALLETS, EVM_WALLETS or APTOS_WALLETS.';
  }

  const lines = ['Configured wallet inventory:'];

  for (const wallet of wallets) {
    lines.push(`${wallet.chain}: ${wallet.address}`);
  }

  return lines.join('\n');
}
