const dotenv = require("dotenv");
dotenv.config();

/**
 * Carga la configuración de CryBot a partir de las variables de entorno.
 * Centraliza claves, parámetros y wallets (EVM, TON, Polygon, Aptos, etc.).
 */
function loadConfig() {
  // Variables críticas
  const required = ["BOT_TOKEN", "ETHERSCAN_API_KEY", "TON_API_KEY", "PRIVATE_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error("Missing required environment variables: " + missing.join(", "));
  }

  return {
    // === Telegram ===
    botToken: process.env.BOT_TOKEN,
    adminId: process.env.ADMIN_TELEGRAM_ID || process.env.ADMIN_ID,

    // === EVM / Ethereum ===
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: process.env.RPC_URL || "https://eth.llamarpc.com",
    etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    polygonPrivateKey: process.env.POLYGON_PRIVATE_KEY,
    polygonRpc: process.env.POLYGON_RPC_URL,
    tonApiKey: process.env.TON_API_KEY,

    // === Endpoints adicionales ===
    ethRpc: process.env.ETH_RPC,
    bscRpc: process.env.BSC_RPC,
    polygonRpcEnv: process.env.POLYGON_RPC,

    // === Airdrops ===
    airdropContracts: (process.env.AIRDROP_CONTRACTS || "")
      .split(",")
      .filter(Boolean),

    // === General ===
    network: process.env.NETWORK || "mainnet",
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || "production",
    scanInterval: parseInt(process.env.SCAN_INTERVAL_MINUTES || "60", 10),
    getgemsInterval: parseInt(process.env.GETGEMS_POLL_MINUTES || "2", 10),

    // === Wallets ===
    wallets: {
      // Dirección principal
      main:
        process.env.MAIN_WALLET ||
        "0x82219fc3B1d22f0DAd2703101724dfA8f08DC456",

      // Wallets EVM (Ethereum, Polygon, BSC)
      evm: (() => {
        const raw = process.env.EVM_WALLET || "";
        const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
        return list.length
          ? list
          : [
              "0x7B9Fc90C99b2ae4711BDEe31049c357999e79B09",
              "0xf37465e2978d90a8feae048d0e15c338d04aa4d6",
              "0x14287D44a3aA5D7025D2cAeBD415a2673F7bEC3E",
            ];
      })(),

      // ✅ Wallets TON (para GetGems y TON Punks)
      ton: (() => {
        const raw =
          process.env.GETGEMS_WALLETS || process.env.TON_WALLET || "";
        const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
        return list.length
          ? list
          : [
              "UQChtGxrxo1H74kGde0GNsSKWYG_rhGMKNco-opmWQ1B-yil",
              "UQDY-o0QuHWumsIKstom7sXBzlX2fQ27-cz4r01e9QatvWZU",
              "UQAMPbQpQJtnPlS5aQQUYMv6uKeEQQg0YQ8bjn0IB1OgheTk",
              "UQCcLv7JUPrlFZ7-504vbxfTxK6o93nHTwwN-Qv16NsCRy20",
            ];
      })(),

      // Wallets Polygon (Planet IX)
      polygon: (() => {
        const raw = process.env.POLYGON_WALLET || "";
        return raw.split(",").map((s) => s.trim()).filter(Boolean);
      })(),

      // Wallets BSC
      bsc: (() => {
        const raw = process.env.BSC_WALLET || "";
        return raw.split(",").map((s) => s.trim()).filter(Boolean);
      })(),

      // Wallets Solana
      solana: (() => {
        const raw = process.env.SOLANA_WALLET || "";
        return raw.split(",").map((s) => s.trim()).filter(Boolean);
      })(),

      // Wallets Aptos
      aptos: (() => {
        const raw = process.env.APTOS_WALLET || "";
        const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
        return list.length
          ? list
          : [
              "0x11353909627b83813dee8d578a636bd042223308acebda7ff1e4220b861de6eb",
              "0xc13873d72475e43d7b33cafa22b8f8123a64315ee999cf41ad1555f26aed5a3a",
            ];
      })(),
    },

    // === Servicios ===
    services: {
      opensea:
        process.env.OPENSEA_API_BASE ||
        "https://api.opensea.io/api/v2",
      looksrare:
        process.env.LOOKSRARE_API_BASE ||
        "https://api.looksrare.org/api/v2",
      blur:
        process.env.BLUR_API_BASE ||
        "https://core-api.blur.io/v1",
      ton:
        process.env.TON_API_BASE ||
        "https://tonapi.io/v2",
    },

    // === Configuración GetGems ===
    getgems: {
      marketplaceAddress: process.env.GETGEMS_MARKETPLACE_ADDRESS,
      feeAddress: process.env.GETGEMS_FEE_ADDRESS,
      destinationAddress: process.env.GETGEMS_DESTINATION_ADDRESS,
      royaltyAddress: process.env.GETGEMS_ROYALTY_ADDRESS,
      defaultPriceTon: parseFloat(process.env.GETGEMS_DEFAULT_PRICE || "5"),
    },

    // === Configuración Planet IX ===
    planetix: {
      marketplaceAddress: process.env.PLANETIX_MARKETPLACE_ADDRESS,
      collectionAddress: process.env.PLANETIX_COLLECTION_ADDRESS,
      abi: (() => {
        try {
          return JSON.parse(process.env.PLANETIX_ABI || "null");
        } catch (_) {
          return null;
        }
      })(),
    },

    // === Tesorería ===
    treasury: {
      targets: {
        stable: parseFloat(process.env.TREASURY_TARGET_STABLE || "0.6"),
        native: parseFloat(process.env.TREASURY_TARGET_NATIVE || "0.3"),
        beta: parseFloat(process.env.TREASURY_TARGET_BETA || "0.1"),
      },
      gasMinimums: {
        ETH: process.env.GAS_MINIMUM_ETH || "0.02",
        TON: process.env.GAS_MINIMUM_TON || "0.30",
      },
      rebalance: {
        intervalHours: parseInt(
          process.env.REBALANCE_INTERVAL_HOURS || "6",
          10
        ),
        deviationPct: parseFloat(
          process.env.REBALANCE_DEVIATION_PCT || "0.05"
        ),
        maxTradePctTreasury: parseFloat(
          process.env.REBALANCE_MAX_TRADE_PCT || "0.03"
        ),
        slippageMaxPct: parseFloat(
          process.env.SLIPPAGE_MAX_PCT || "1"
        ),
        priceShockThresholdPct: parseFloat(
          process.env.PRICE_SHOCK_PCT || "0.1"
        ),
      },
      pricing: {
        floorFollowDeltaPct: parseFloat(
          process.env.FLOOR_FOLLOW_DELTA_PCT || "2"
        ),
        acceptOfferFloorMultiplier: parseFloat(
          process.env.ACCEPT_OFFER_FLOOR_MULTIPLIER || "0.95"
        ),
        staleDaysBeforeDiscount: parseInt(
          process.env.STALE_DAYS_BEFORE_DISCOUNT || "7",
          10
        ),
      },
      safety: {
        maxConsecutiveFailures: parseInt(
          process.env.MAX_CONSECUTIVE_FAILURES || "3",
          10
        ),
        pauseOnGasSpikePct: parseFloat(
          process.env.PAUSE_ON_GAS_SPIKE_PCT || "2"
        ),
      },
    },

    // === Semilla TON para listar NFTs ===
    tonWalletSeed: process.env.TON_WALLET_SEED,
  };
}

module.exports = { loadConfig };

if (process.env.NODE_ENV !== "production") {
  console.log("✅ Configuración cargada correctamente");
}