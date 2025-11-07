// ======================================================
// 🤖 CryBot Final 2.1 — Multi-Chain Auto Manager (Estable)
// ======================================================
const { Telegraf } = require("telegraf");
const axios = require("axios");
const { ethers } = require("ethers");
const cron = require("node-cron");
const express = require("express");
const { loadConfig } = require("./config");

// === Cargar configuración ===
const config = loadConfig();
const provider = new ethers.JsonRpcProvider(config.rpcUrl);

// === Inicializar wallet EVM ===
let wallet = null;
try {
  if (config.privateKey) {
    wallet = new ethers.Wallet(config.privateKey, provider);
    console.log("🔑 Wallet EVM inicializada:", wallet.address);
  } else {
    console.warn("⚠️ PRIVATE_KEY no configurada, modo lectura.");
  }
} catch (err) {
  console.error("❌ Error inicializando wallet EVM:", err.message);
}

// === Instancia del bot ===
const bot = new Telegraf(config.botToken);
const isAdmin = (ctx) => String(ctx.from?.id) === String(config.adminId);

// === Funciones utilitarias ===
async function scanEvm(addr) {
  try {
    const bal = await provider.getBalance(addr);
    return { address: addr, eth: Number(ethers.formatEther(bal)) };
  } catch {
    return { address: addr, eth: 0 };
  }
}

async function scanTon(addr) {
  if (!config.tonApiKey) return { address: addr, ton: 0 };
  try {
    const res = await axios.get(`https://tonapi.io/v2/accounts/${addr}`, {
      headers: { "x-api-key": config.tonApiKey },
    });
    return { address: addr, ton: res.data.balance / 1e9 || 0 };
  } catch {
    return { address: addr, ton: 0 };
  }
}

async function getTokenPrices(symbols) {
  try {
    const res = await axios.get(
      "https://min-api.cryptocompare.com/data/pricemulti",
      { params: { fsyms: symbols.join(","), tsyms: "USD" } }
    );
    return res.data;
  } catch {
    return {};
  }
}

// === Generar resumen diario ===
async function generateResumen() {
  const ethBal = await scanEvm(config.wallets?.evm?.[0]);
  const tonBal = await scanTon(config.wallets?.ton?.[0]);
  const prices = await getTokenPrices(["ETH", "TONCOIN"]);
  const ethUsd = (ethBal.eth * (prices.ETH?.USD || 0)).toFixed(2);
  const tonUsd = (tonBal.ton * (prices.TONCOIN?.USD || 0)).toFixed(2);

  return (
    `📊 *Resumen Diario*\n` +
    `💰 ETH: ${ethBal.eth.toFixed(4)} (${ethUsd} USD)\n` +
    `💎 TON: ${tonBal.ton.toFixed(2)} (${tonUsd} USD)\n\n` +
    `🕘 ${new Date().toLocaleString()}`
  );
}

// === Comandos del bot ===
bot.start((ctx) => ctx.reply("🚀 CryBot activo. Usa /help"));
bot.command("help", (ctx) =>
  ctx.reply(
    [
      "/status — test de vida",
      "/saldo — ver balances",
      "/ton — mostrar saldo TON",
      "/tokens — valor estimado",
      "/resumen — reporte diario",
    ].join("\n")
  )
);
bot.command("status", (ctx) => ctx.reply("✅ OK, bot operativo."));

bot.command("saldo", async (ctx) => {
  const evm = await scanEvm(config.wallets?.evm?.[0]);
  const ton = await scanTon(config.wallets?.ton?.[0]);
  ctx.reply(`📦 *Saldos:*\nETH: ${evm.eth} ETH\nTON: ${ton.ton} TON`, {
    parse_mode: "Markdown",
  });
});

bot.command("ton", async (ctx) => {
  const ton = await scanTon(config.wallets?.ton?.[0]);
  ctx.reply(`💎 Wallet TON: ${ton.address}\n💰 Saldo: ${ton.ton.toFixed(3)} TON`);
});

bot.command("tokens", async (ctx) => {
  const summary = await getTokenPrices(["ETH", "TONCOIN"]);
  ctx.reply(
    `💎 Precios actuales:\nETH: ${summary.ETH?.USD || "?"} USD\nTON: ${
      summary.TONCOIN?.USD || "?"
    } USD`
  );
});

bot.command("resumen", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("❌ No autorizado");
  const msg = await generateResumen();
  ctx.reply(msg, { parse_mode: "Markdown" });
});

// === CRON para enviar resumen diario a las 09:00 ===
cron.schedule("0 9 * * *", async () => {
  try {
    const msg = await generateResumen();
    await bot.telegram.sendMessage(config.adminId, msg, {
      parse_mode: "Markdown",
    });
    console.log("📤 Reporte diario enviado");
  } catch (e) {
    console.error("Error enviando reporte diario:", e.message);
  }
});

// === Configuración del servidor Express + Webhook ===
const app = express();
app.use(express.json());
const DOMAIN = process.env.APP_URL || "https://crybot.up.railway.app";
const WEBHOOK_PATH = "/webhook";
const WEBHOOK_URL = `${DOMAIN}${WEBHOOK_PATH}`;
const PORT = process.env.PORT || 3000;

// Endpoint de Webhook
app.post(WEBHOOK_PATH, (req, res) => bot.handleUpdate(req.body, res));
app.get("/", (_, res) =>
  res.send("✅ CryBot activo y escuchando updates desde Telegram.")
);

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor HTTP en puerto ${PORT}`);
  try {
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`🌐 Webhook configurado correctamente: ${WEBHOOK_URL}`);
  } catch (err) {
    console.error("❌ Error configurando webhook:", err.message);
  }
});

// === Health Monitor ===
let fails = 0;
setInterval(async () => {
  try {
    const res = await axios.get(`${DOMAIN}/`);
    if (res.status === 200) {
      fails = 0;
      console.log("✅ Webhook activo");
    } else {
      fails++;
    }
  } catch {
    fails++;
  }
  if (fails >= 3) {
    console.error("❌ Webhook caído, reiniciando...");
    process.exit(1);
  }
}, 1000 * 60 * 5); // cada 5 minutos

// === Módulos externos seguros ===
try {
  startAutoListing(bot, config.getgems?.listInterval);
  startMonitoring(bot, config.planetix?.pollInterval);
  console.log("💰 Módulos de venta activos");
} catch (err) {
  console.warn("⚠️ Error iniciando módulos externos:", err.message);
}