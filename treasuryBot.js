/**
 * Stub Treasury Bot module
 * This placeholder prevents module not found errors when the real implementation is not available.
 */
class TreasuryBot {
  constructor(treasuryConfig, balanceProvider, swapper, oracle, marketplace) {
    console.warn('Using stub TreasuryBot. Real implementation missing.');
  }

  start() {
    console.warn('Stub TreasuryBot start() called. No action performed.');
  }
}

module.exports = { TreasuryBot };
