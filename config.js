const dotenv = require('dotenv');
dotenv.config();


 function loadConfig() {
  const required = ['BOT_TOKEN', 'ETHERSCAN_API_KEY', 'TON_API_KEY', 'PRIVATE_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`⚠️ Faltan variables de entorno: ${missing.join(', ')}`);
  }

  return {
    // --- Telegram ---
    botToken: process.env.BOT_TOKEN,

    // --- Blockchain ---
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: process.env.RPC_URL || 'https://eth.llamarpc.com',
    etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    tonApiKey: process.env.TON_API_KEY,

    // --- General ---
    network: process.env.NETWORK || 'mainnet',
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'production',

    // --- Wallets controladas ---
    wallets: {
      main: '0x82219fc3B1d22f0DAd2703101724dfA8f08DC456', // wallet limpia
      evm: [
        '0x7B9Fc90C99b2ae4711BDEe31049c357999e79B09',
        '0xf37465e2978d90a8feae048d0e15c338d04aa4d6',
        '0x14287D44a3aA5D7025D2cAeBD415a2673F7bEC3E'
      ],
      ton: [
        'UQChtGxrxo1H74kGde0GNsSKWYG_rhGMKNco-opmWQ1B-yil',
        'UQDY-o0QuHWumsIKstom7sXBzlX2fQ27-cz4r01e9QatvWZU',
        'UQAMPbQpQJtnPlS5aQQUYMv6uKeEQQg0YQ8bjn0IB1OgheTk',
        'UQCcLv7JUPrlFZ7-504vbxfTxK6o93nHTwwN-Qv16NsCRy20'
      ],
      aptos: [
        '0x11353909627b83813dee8d578a636bd042223308acebda7ff1e4220b861de6eb',
        '0xc13873d72475e43d7b33cafa22b8f8123a64315ee999cf41ad1555f26aed5a3a'
      ],
    },

    // --- APIs y servicios externos ---
    services: {
      opensea: 'https://api.opensea.io/api/v2',
      looksrare: 'https://api.looksrare.org/api/v2',
      blur: 'https://core-api.blur.io/v1',
      ton: 'https://tonapi.io/v2',
    }
  };
   



   

   module.exports = { loadConfig };

   
}
