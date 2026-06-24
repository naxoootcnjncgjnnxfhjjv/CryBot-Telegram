// Read-only TON balance fetch (safe)

async function getBalances(wallets = []) {
  // TODO: implement with TON API
  return wallets.map(w => ({ wallet: w, balance: 0 }));
}

module.exports = { getBalances };