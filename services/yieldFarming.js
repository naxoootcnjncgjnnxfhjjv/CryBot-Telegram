const axios = require('axios');

async function getAaveRates() {
  // This function should fetch stablecoin APY rates from Aave, Compound or Yearn.
  // It returns an object with example rates for USDC, DAI and USDT.
  // TODO: Replace example values with real API calls to protocols.
  return {
    USDC: '3.5%',
    DAI: '3.2%',
    USDT: '3.4%',
  };
}

module.exports = {
  getAaveRates,
};
