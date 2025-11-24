const axios = require('axios');

async function getRestakingOptions() {
  // For demonstration, return sample restaking options
  return [
    {
      protocol: 'EigenLayer',
      asset: 'stETH',
      apr: '5.5%',
      lockup: 'No fixed lockup'
    },
    {
      protocol: 'EigenLayer',
      asset: 'rETH',
      apr: '5.2%',
      lockup: 'No fixed lockup'
    }
  ];
}

module.exports = { getRestakingOptions };
