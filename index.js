// ======================================================
// 🤖 CryBot Final 2.2 — Multi-Chain Auto Manager (Railway-Ready)
// ======================================================
const { Telegraf } = require("telegraf");
const axios = require("axios");
const { ethers } = require("ethers");
const cron = require("node-cron");
const express = require("express");
const { loadConfig } = require("./config");

// === Importar módulos auxiliares ===
const { startAutoListing } = require("./sell_getgems");
const { startMonitoring } = require("./sell_planetix");
const getgems = require("./getgems");
const sellEngine = require("./sell-engine");
const storage = require("./storage");
const { TreasuryBot } = require("./treasuryBot.js");

// === Cargar configuración y preparar entorno ===
const config = loadConfig();
const provider = new ethers.JsonRpcProvider(config.rpcUrl);

// === Inicializar Wallet EVM principal ===
let wallet = null;
if (config.privateKey) {
  try {
    wallet = new ethers.Wallet(config.privateKey, provider);
    console.log("🔑 Wallet EVM inicializada:", wallet.address);
  } catch (err) {
    console.error("❌ PRIVATE_KEY inválida:", err.message);
  }
} else {
  console.warn("⚠️ PRIVATE_KEY no configurada, modo lectura-solo.");
}

// === Instancia del bot ===
const bot = new Telegraf(config.botToken);
const isAdmin = (ctx) => String(ctx.from?.id) === String(config.adminId);

// === Utilidades de escaneo ===
async function scanEvm(addr) {
  try {
    const bal = await provider.getBalance(addr);
    return { address: addr, eth: Number(ethers.formatEther(bal)) };
  } catch (err) {
    console.error("EVM Scan Error:", err.message);
    return { address: addr, eth: 0 };
  }
}

async function scanTon(addr) {
  if (!config.tonApiKey) return { address: addr, ton: 0 };
  try {
    const res = await axios.get(`https://tonapi.io/v2/accounts/${addr}`, {
      headers: { "x-api-key": config.tonApiKey },
    });
    const balance = res.data?.balance ? res.data.balance / 1e9 : 0;
    return { address: addr, ton: balance };
  } catch (err) {
    console.error("TON Scan Error:", err.message);
    return { address: addr, ton: 0 };
  }
}

// === Función para obtener precios ===
async function getTokenPrices(symbols) {
  try {
    const res = await axios.get(
      "https://min-api.cryptocompare.com/data/pricemulti",
      { params: { fsyms: symbols.join(","), tsyms: "USD" } }
    );
    return res.data;
  } catch (err) {
    console.error("Error obteniendo precios:", err.message);
    return {};
  }
}

// === Funciones de resumen ===
async function getTokenSummary() {
  const evmAddrs = config.wallets?.evm || [];
  const tonAddrs = config.wallets?.ton || [];
  let totalEth = 0,
    totalTon = 0;

  for (const addr of evmAddrs) {
    const bal = await scanEvm(addr);
    totalEth += bal.eth || 0;
  }
  for (const addr of tonAddrs) {
    const bal = await scanTon(addr);
    totalTon += bal.ton || 0;
  }

  const prices = await getTokenPrices(["ETH", "TONCOIN"]);
  const ethUsd = prices?.ETH?.USD || 0;
  const tonUsd = prices?.TONCOIN?.USD || 0;

  return {
    ETH: { amount: totalEth, usd: totalEth * ethUsd },
    TON: { amount: totalTon, usd: totalTon * tonUsd },
  };
}

// === Generar mensaje de resumen completo ===
async function generateResumen() {
  const evmAddrs = config.wallets?.evm || [];
  const tonAddrs = config.wallets?.ton || [];
  let message = "📊 Resumen diario\n";

  for (const addr of evmAddrs) {
    const bal = await scanEvm(addr);
    message += `• ETH (${addr.slice(0, 6)}…): ${bal.eth || 0} ETH\n`;
  }
  for (const addr of tonAddrs) {
    const bal = await scanTon(addr);
    message += `• TON (${addr.slice(0, 6)}…): ${bal.ton || 0} TON\n`;
  }

  const tokens = await getTokenSummary();
  message += "\n💎 Tokens:\n";
  for (const key of Object.keys(tokens)) {
    const t = tokens[key];
    const usdVal = isNaN(t.usd) ? 0 : t.usd;
    message += `${key}: ${t.amount} (≈ $${usdVal.toFixed(2)})\n`;
  }
  return message;
}

// === Comandos básicos del bot ===
bot.start((ctx) => ctx.reply("🚀 CryBot activo. Usa /help"));
bot.command("help", (ctx) =>
  ctx.reply(
    [
      "/status — test de vida",
      "/saldo — ver balances de todas las wallets",
      "/tokens — listar tokens y valor estimado",
      "/reclamar — ejecutar reclamos automáticos",
      "/enviar <ETH> <destino> — enviar manual (admin)",
      "/panel — resumen general",
      "/resumen — enviar resumen diario",
    ].join("\n")
  )
);
bot.command("status", (ctx) => ctx.reply("✅ OK, bot operativo."));
// === Comandos principales ===

// === /saldo ===
bot.command("saldo", async (ctx) => {
  try {
    const evmAddrs = config.wallets?.evm || [];
    const tonAddrs = config.wallets?.ton || [];
    let message = "📦 *Saldos actuales:*\n\n";

    for (const addr of evmAddrs) {
      const evm = await scanEvm(addr);
      message += `• ETH (${addr.slice(0, 8)}…): ${evm.eth.toFixed(4)} ETH\n`;
    }

    for (const addr of tonAddrs) {
      const ton = await scanTon(addr);
      message += `• TON (${addr.slice(0, 8)}…): ${ton.ton.toFixed(2)} TON\n`;
    }

    message += `\n➡️ Principal: ${config.wallets?.main}`;
    ctx.reply(message, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Error en /saldo:", err.message);
    ctx.reply("❌ Error al obtener saldos.");
  }
});

// === /tokens ===
bot.command("tokens", async (ctx) => {
  try {
    const summary = await getTokenSummary();
    let msg = "💎 *Tokens y valor estimado:*\n\n";
    for (const key of Object.keys(summary)) {
      const t = summary[key];
      const usdVal = isNaN(t.usd) ? 0 : t.usd;
      msg += `${key}: ${t.amount.toFixed(4)} (≈ $${usdVal.toFixed(2)})\n`;
    }
    ctx.reply(msg, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Error en /tokens:", err.message);
    ctx.reply("❌ No se pudieron obtener los tokens.");
  }
});

// === /panel ===
bot.command("panel", async (ctx) => {
  try {
    const evmAddrs = config.wallets?.evm || [];
    const tonAddrs = config.wallets?.ton || [];
    let msg = "📋 *Panel general:*\n\nBalances:\n";
    for (const addr of evmAddrs) {
      const bal = await scanEvm(addr);
      msg += `• ETH (${addr.slice(0, 8)}…): ${bal.eth.toFixed(4)} ETH\n`;
    }
    for (const addr of tonAddrs) {
      const bal = await scanTon(addr);
      msg += `• TON (${addr.slice(0, 8)}…): ${bal.ton.toFixed(2)} TON\n`;
    }

    const tokens = await getTokenSummary();
    msg += "\nTokens:\n";
    for (const key of Object.keys(tokens)) {
      const t = tokens[key];
      const usdVal = isNaN(t.usd) ? 0 : t.usd;
      msg += `${key}: ${t.amount} (≈ $${usdVal.toFixed(2)})\n`;
    }

    ctx.reply(msg, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Error en /panel:", err.message);
    ctx.reply("❌ No se pudo generar el panel.");
  }
});

// === /resumen ===
bot.command("resumen", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("❌ No autorizado.");
  try {
    const msg = await generateResumen();
    ctx.reply(msg, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Error en /resumen:", err.message);
    ctx.reply("❌ Error generando resumen.");
  }
});

// === Cron de reportes automáticos ===
cron.schedule("0 9 * * *", async () => {
  try {
    const resumen = await generateResumen();
    await bot.telegram.sendMessage(config.adminId, resumen, {
      parse_mode: "Markdown",
    });
    console.log("📤 Reporte diario enviado correctamente.");
  } catch (err) {
    console.error("Error en cron diario:", err.message);
  }
});

// === Escaneo periódico cada hora ===
setInterval(async () => {
  try {
    const evm = await scanEvm(config.wallets?.evm?.[0]);
    const ton = await scanTon(config.wallets?.ton?.[0]);
    await bot.telegram.sendMessage(
      config.adminId,
      `⏰ Escaneo automático:\nETH: ${evm.eth.toFixed(4)} ETH\nTON: ${ton.ton.toFixed(2)} TON`
    );
  } catch (err) {
    console.error("Error en escaneo automático:", err.message);
  }
}, 60 * 60 * 1000);
// ======================================================
// 🌐 Servidor Express + Webhook + Dashboard
// ======================================================

const app = express();
app.use(express.json());

// === Configuración base ===
const DOMAIN = process.env.APP_URL || "https://crybot.up.railway.app";
const WEBHOOK_PATH = "/webhook";
const WEBHOOK_URL = `${DOMAIN}${WEBHOOK_PATH}`;
const PORT = process.env.PORT || 3000;

// === Archivos estáticos y rutas ===
app.use(express.static("public"));

app.get("/", (_, res) =>
  res.send("✅ CryBot activo y escuchando updates desde Telegram.")
);
app.get("/dashboard", (_, res) =>
  res.sendFile(__dirname + "/public/dashboard.html")
);
// === Iniciar monitoreo automático de GetGems y PlanetIX ===
try {
  startMonitoring(bot);
  console.log("🎨 GetGems monitor iniciado correctamente.");
} catch (err) {
  console.error("❌ Error al iniciar monitoreo GetGems:", err.message);
}
// === Endpoint de webhook ===
app.post(WEBHOOK_PATH, async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error procesando update:", err.message);
    res.status(200).send("Error");
  }
});

// === Endpoint de datos para dashboard ===
app.get("/api/dashboard", async (req, res) => {
  try {
    const evmAddr = config.wallets?.evm?.[0];
    const tonAddr = config.wallets?.ton?.[0];
    const evmBal = await scanEvm(evmAddr);
    const tonBal = await scanTon(tonAddr);
    const tokens = await getTokenSummary();
    const farming = "EigenLayer + Etherfi activos";
    const rewards = "Último claim hace 2 h";

    res.json({
      balance: `${(evmBal.eth || 0).toFixed(4)} ETH | ${(tonBal.ton || 0).toFixed(2)} TON`,
      nfts: "Planet IX + TON Punks detectados",
      farming,
      rewards,
      tokens,
    });
  } catch (err) {
    console.error("Error /api/dashboard:", err.message);
    res.json({ error: err.message });
  }
});

// === Iniciar servidor Express y configurar webhook ===
// === Iniciar servidor Express y configurar webhook ===
app.listen(PORT, async () => {
  console.log(`🚀 Servidor HTTP iniciado en puerto ${PORT}`);

  try {
    // Intentar configurar webhook normal
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`🌐 Webhook configurado correctamente: ${WEBHOOK_URL}`);
  } catch (err) {
    console.error("❌ Error configurando webhook:", err.message);

    // === Fallback automático: modo polling ===
    try {
      await bot.telegram.deleteWebhook().catch(() => {});
      await bot.launch();
      console.log("🛰 Webhook alternativo en modo polling activado.");
    } catch (pollErr) {
      console.error("⚠️ Error iniciando modo polling:", pollErr.message);
    }
  }

  console.log("🌎 Esperando updates desde Telegram...");
});
// ======================================================
// ♻️ Health Monitor + Módulos externos y Tesorería
// ======================================================

let failedChecks = 0;
const MAX_FAILS = 3;
const CHECK_INTERVAL_MS = 1000 * 60 * 5; // cada 5 minutos

async function checkWebhookHealth() {
  try {
    const res = await axios.get(`${DOMAIN}/`);
    if (res.status === 200) {
      failedChecks = 0;
      console.log("✅ Webhook activo y respondiendo correctamente.");
    } else {
      failedChecks++;
      console.warn(`⚠️ Respuesta inesperada (${res.status}), intento ${failedChecks}/${MAX_FAILS}`);
    }
  } catch (err) {
    failedChecks++;
    console.warn(`⚠️ Error comprobando webhook: ${err.message} (intento ${failedChecks}/${MAX_FAILS})`);
  }

  if (failedChecks >= MAX_FAILS) {
    console.error("❌ Webhook inactivo repetidamente. Reiniciando proceso...");
    process.exit(1); // Railway reinicia automáticamente el contenedor
  }
}

// Ejecutar chequeo de salud y pings periódicos
setInterval(checkWebhookHealth, CHECK_INTERVAL_MS);
setInterval(async () => {
  try {
    await axios.get(`${DOMAIN}/`);
    console.log("💓 Ping de salud enviado");
  } catch (err) {
    console.warn("⚠️ Error en ping de salud:", err.message);
  }
}, 1000 * 60 * 5);

// ======================================================
// 🔁 Inicializar módulos de venta y Tesorería
// ======================================================

try {
  startAutoListing(bot, config.getgems?.listInterval);
  startMonitoring(bot, config.planetix?.pollInterval);
  console.log("💰 Módulos de venta automática activos.");
} catch (err) {
  console.warn("⚠️ Error iniciando módulos de venta:", err.message);
}

try {
  const treasuryConfig = {
    treasuryTargets: config.treasury.targets,
    gasMinimums: {
      ETH: ethers.parseEther(String(config.treasury.gasMinimums.ETH)),
      TON: ethers.parseEther(String(config.treasury.gasMinimums.TON)),
    },
    rebalance: config.treasury.rebalance,
    pricing: config.treasury.pricing,
    safety: config.treasury.safety,
  };

  const { BotBalanceProvider, BotSwapper, BotPriceOracle, BotNFTMarketplace } = require("./treasuryBot.js");

  const balanceProvider = new BotBalanceProvider(config);
  const swapper = new BotSwapper();
  const oracle = new BotPriceOracle();
  const marketplace = new BotNFTMarketplace(config);

  const treasuryBot = new TreasuryBot(
    treasuryConfig,
    balanceProvider,
    swapper,
    oracle,
    marketplace
  );

  treasuryBot.start();
  console.log("🏦 TreasuryBot iniciado correctamente.");
} catch (err) {
  console.error("Error inicializando TreasuryBot:", err.message);
}

// ======================================================
// ✅ CryBot 2.2 listo en Railway
// ======================================================