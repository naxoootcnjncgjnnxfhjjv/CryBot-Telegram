// Wallet classification (active/uninit)

function classifyWallet(state) {
  if (!state) return 'unknown';
  if (state === 'active') return 'active';
  if (state === 'uninit') return 'uninit';
  return 'nonexist';
}

module.exports = { classifyWallet };