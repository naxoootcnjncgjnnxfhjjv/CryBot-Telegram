// Read-only report builder

function buildReport(wallets = []) {
  return {
    generated_at: new Date().toISOString(),
    wallets,
    summary: {
      wallet_count: wallets.length,
      active_count: wallets.filter(w => w.state === 'active').length,
      uninit_count: wallets.filter(w => w.state === 'uninit').length,
      nft_count: wallets.reduce((acc, w) => acc + (w.nfts?.length || 0), 0)
    }
  };
}

module.exports = { buildReport };