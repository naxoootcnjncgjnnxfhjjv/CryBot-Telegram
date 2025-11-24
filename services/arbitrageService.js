const axios = require('axios');

// Sample function to fetch arbitrage opportunities. In a real implementation, it would fetch price data from APIs.
async function getArbitrageOpportunities() {
  // For demonstration, return some dummy arbitrage opportunities between DEX and CEX
  return [
    {
      pair: 'ETH/USDT',
      dexPrice: '2000',
      cexPrice: '2050',
      profitPct: '2.5%'
    },
    {
      pair: 'BTC/USDT',
      dexPrice: '30000',
      cexPrice: '30300',
      profitPct: '1%'
    }
  ];
}

module.exports = { getArbitrageOpportunities };
