const dotenv = require('dotenv');
dotenv.config();


function loadConfig() {
  const required = ['BOT_TOKEN', 'ETHERSCAN_API_KEY', 'TON_API_KEY', 'PRIVATE_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
  
  
  return {
    // --- Telegram ---
    botToken: process.env.BOT_TOKEN,
    // Admin user ID to restrict privileged commands
    adminId: process.env.ADMIN_TELEGRAM_ID || process.env.ADMIN_ID,

    // --- Blockchain ---
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: process.env.RPC_URL || 'https://eth.llamarpc.com',
    etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    tonApiKey: process.env.TON_API_KEY,
        // Additional RPC endpoints for multi-chain support
    ethRpc: process.env.ETH_RPC,
    bscRpc: process.env.BSC_RPC,
    polygonRpc: process.env.POLYGON_RPC,

    // List of contracts to claim rewards from (comma-separated in env)
    airdropContracts: (process.env.AIRDROP_CONTRACTS || '').split(',').filter(Boolean),

    // --- General ---
    network: process.env.NETWORK || 'mainnet',
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'production',

          // Interval for periodic scanning of wallets (minutes)
      scanInterval: parseInt(process.env.SCAN_INTERVAL_MINUTES || "60", 10),
      // Interval for GetGems polling in minutes
      getgemsInterval: parseInt(process.env.GETGEMS_POLL_MINUTES || "2", 10),
    // --- Wallets controladas ---
    wallets: {
      // Main wallet where profits and fees are consolidated
      main: process.env.MAIN_WALLET || '0x82219fc3B1d22f0DAd2703101724dfA8f08DC456',
      evm: (process.env.EVM_WALLET || '').split(',').filter(Boolean).length
        ? (process.env.EVM_WALLET || '').split(',').filter(Boolean)
        : [
            '0x7B9Fc90C99b2ae4711BDEe31049c357999e79B09',
            '0xf37465e2978d90a8feae048d0e15c338d04aa4d6',
            '0x14287D44a3aA5D7025D2cAeBD415a2673F7bEC3E',
          ],
      ton: (process.env.TON_WALLET || '').split(',').filter(Boolean).length
        ? (process.env.TON_WALLET || '').split(',').filter(Boolean)
        : [
            'UQChtGxrxo1H74kGde0GNsSKWYG_rhGMKNco-opmWQ1B-yil',
            'UQDY-o0QuHWumsIKstom7sXBzlX2fQ27-cz4r01e9QatvWZU',
            'UQAMPbQpQJtnPlS5aQQUYMv6uKeEQQg0YQ8bjn0IB1OgheTk',
            'UQCcLv7JUPrlFZ7-504vbxfTxK6o93nHTwwN-Qv16NsCRy20',
          ],
      aptos: (process.env.APTOS_WALLET || '').split(',').filter(Boolean).length
        ? (process.env.APTOS_WALLET || '').split(',').filter(Boolean)
        : [
            '0x11353909627b83813dee8d578a636bd042223308acebda7ff1e4220b861de6eb',
            '0xc13873d72475e43d7b33cafa22b8f8123a64315ee999cf41ad1555f26aed5a3a',
          ],
    },

    // --- APIs y servicios externos ---
    services: {
      opensea: process.env.OPENSEA_API_BASE || 'https://api.opensea.io/api/v2',
      looksrare: process.env.LOOKSRARE_API_BASE || 'https://api.looksrare.org/api/v2',
      blur: process.env.BLUR_API_BASE || 'https://core-api.blur.io/v1',
      ton: process.env.TON_API_BASE || 'https://tonapi.io/v2',
    },

    /**
     * Configuration for the treasury bot. These values can be overridden
     * via environment variables if desired. See `treasuryBot.ts` for more
     * details on how these parameters are used.
     */
    treasury: {
      targets: {
        stable: parseFloat(process.env.TREASURY_TARGET_STABLE || '0.6'),
        native: parseFloat(process.env.TREASURY_TARGET_NATIVE || '0.3'),
        beta: parseFloat(process.env.TREASURY_TARGET_BETA || '0.1'),
      },
      gasMinimums: {
        // Minimum gas reserves per network expressed as strings.  The
        // treasury bot will convert these values to BigNumber when
        // executing.  Adjust via environment variables as needed.
        ETH: process.env.GAS_MINIMUM_ETH || '0.02',
        TON: process.env.GAS_MINIMUM_TON || '0.30',
      },
      rebalance: {
        intervalHours: parseInt(process.env.REBALANCE_INTERVAL_HOURS || '6', 10),
        deviationPct: parseFloat(process.env.REBALANCE_DEVIATION_PCT || '0.05'),
        maxTradePctTreasury: parseFloat(process.env.REBALANCE_MAX_TRADE_PCT || '0.03'),
        slippageMaxPct: parseFloat(process.env.SLIPPAGE_MAX_PCT || '1'),
        priceShockThresholdPct: parseFloat(process.env.PRICE_SHOCK_PCT || '0.1'),
      },
      pricing: {
        floorFollowDeltaPct: parseFloat(process.env.FLOOR_FOLLOW_DELTA_PCT || '2'),
        acceptOfferFloorMultiplier: parseFloat(
          process.env.ACCEPT_OFFER_FLOOR_MULTIPLIER || '0.95'
        ),
        staleDaysBeforeDiscount: parseInt(process.env.STALE_DAYS_BEFORE_DISCOUNT || '7', 10),
      },
      safety: {
        maxConsecutiveFailures: parseInt(process.env.MAX_CONSECUTIVE_FAILURES || '3', 10),
        pauseOnGasSpikePct: parseFloat(process.env.PAUSE_ON_GAS_SPIKE_PCT || '2'),
      },
    },
  };
}

}
  module.exports = { loadConfig };
