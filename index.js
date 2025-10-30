// ======================================================
// 🤖 CryBot Final 2.0 — Multi-Chain Auto Manager
// ======================================================
const { Telegraf } = require("telegraf");
const axios = require("axios");
const { ethers } = require("ethers");
const cron = require("node-cron");
const { loadConfig } = require("./config");

// === Cargar configuración ===
const config = loadConfig();
const provider = new ethers.JsonRpcProvider(config.rpcUrl);

// === Inicializar wallet EVM (si hay PRIVATE_KEY) ===
let wallet = null;
if (config.privateKey) {
  try {
    wallet = new ethers.Wallet(config.privateKey, provider);
    console.log("🔑 Wallet EVM inicializada:", wallet.address);
  } catch (err) {
    console.error("❌ PRIVATE_KEY inválida:", err.message);
  }
}

// === Instancia del bot ===
const bot = new Telegraf(config.botToken);

// === Helper de permisos ===
const isAdmin = (ctx) => String(ctx.from?.id) === String(config.adminId);

// === Escanear balance EVM ===
async function scanEvm(addr) {
  try {
    const bal = await provider.getBalance(addr);
    return { address: addr, eth: Number(ethers.formatEther(bal)) };
  } catch (err) {
    return { address: addr, error: err.message };
  }
}

// === Escanear balance TON ===
async function scanTon(addr) {
  if (!config.tonApiKey) return { address: addr, error: "Missing TON API key" };
  try {
    const res = await axios.get(
      `https://tonapi.io/v2/accounts/${addr}`,
      { headers: { "x-api-key": config.tonApiKey } }
    );
    const balance = res.data?.balance ? res.data.balance / 1e9 : 0;
    return { address: addr, ton: balance };
  } catch (err) {
    return { address: addr, error: err.message };
  }
}

// === Reclamo de airdrops (simplificado) ===
async function claimAirdropsForAll() {
  const wallets = [
    ...(config.wallets?.evm || []).map((a) => ({ type: "evm", address: a })),
    ...(config.wallets?.ton || []).map((a) => ({ type: "ton", address: a })),
  ];
  const results = [];
  for (const w of wallets) {
    try {
      if (w.type === "evm") {
        const claim = await axios
          .get(`https://api.blast.io/airdrops/${w.address}`)
          .catch(() => null);
        if (claim?.data?.amount > 0)
          results.push({ ...w, claimed: true, amount: claim.data.amount });
        else results.push({ ...w, claimed: false });
      } else if (w.type === "ton") {
        const claim = await axios
          .get(`https://tonapi.io/v2/accounts/${w.address}/rewards`, {
            headers: { "x-api-key": config.tonApiKey },
          })
          .catch(() => null);
        if (claim?.data?.claimable > 0)
          results.push({
            ...w,
            claimed: true,
            amount: claim.data.claimable / 1e9,
          });
        else results.push({ ...w, claimed: false });
      }
    } catch (err) {
      results.push({ ...w, error: err.message });
    }
  }
  return results;
}

// === Envío automático a wallet principal ===
async function autoTransferToMain(amountEth) {
  if (!wallet) return "No wallet configured";
  try {
    const tx = await wallet.sendTransaction({
      to: config.wallets.main,
      value: ethers.parseEther(String(amountEth)),
    });
    console.log(`💸 Transferido ${amountEth} ETH a ${config.wallets.main}`);
    return tx.hash;
  } catch (err) {
    console.error("Error auto-transfer:", err.message);
    return err.message;
  }
}

// === Comandos Telegram ===
bot.start((ctx) => ctx.reply("🚀 CryBot activo. Usa /help"));
bot.command("help", (ctx) =>
  ctx.reply(
    [
      "/status — test de vida",
      "/saldo — ver balances EVM / TON",
      "/nfts — listar NFTs (OpenSea)",
      "/reclamar — ejecutar reclamos automáticos",
      "/enviar <eth> <to> — enviar ETH manual (solo admin)",
    ].join("\n")
  )
);

bot.command("status", (ctx) => ctx.reply("✅ OK, bot activo."));

bot.command("saldo", async (ctx) => {
  const evmAddr = config.wallets?.evm?.[0];
  const tonAddr = config.wallets?.ton?.[0];
  const evm = await scanEvm(evmAddr);
  const ton = await scanTon(tonAddr);
  ctx.reply(
    `💰 *Balances detectados:*\nEVM (${evmAddr}): ${evm.eth || 0} ETH\nTON (${tonAddr}): ${ton.ton || 0} TON`,
    { parse_mode: "Markdown" }
  );
});

bot.command("reclamar", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("❌ No autorizado");
  ctx.reply("🪂 Ejecutando reclamos...");
  const res = await claimAirdropsForAll();
  ctx.reply(`Resultado:\n${JSON.stringify(res, null, 2)}`);
});

bot.command("nfts", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("❌ No autorizado");
  const addr = config.wallets?.evm?.[0];
  ctx.reply("🎨 Escaneando NFTs en OpenSea...");
  try {
    const res = await axios.get(
      `https://api.opensea.io/api/v2/chain/ethereum/account/${addr}/nfts`
    );
    const nfts = res.data?.nfts || [];
    const toSell = nfts.filter((n) => n.floor_price_usd >= 5);
    ctx.reply(
      `NFTs detectados: ${nfts.length}\nListos para venta (> $5): ${toSell.length}`
    );
  } catch (err) {
    ctx.reply(`❌ Error NFTs: ${err.message}`);
  }
});

bot.command("enviar", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("❌ No autorizado");
  if (!wallet) return ctx.reply("❌ No hay wallet configurada");
  const [_, amountStr, to] = ctx.message.text.trim().split(/\s+/);
  if (!amountStr || !to) return ctx.reply("Uso: /enviar <ETH> <to>");
  if (!ethers.isAddress(to)) return ctx.reply("Dirección inválida");
  try {
    const value = ethers.parseEther(amountStr);
    const tx = await wallet.sendTransaction({ to, value });
    ctx.reply(`✅ Enviado ${amountStr} ETH → ${to}\nTx: ${tx.hash}`);
  } catch (err) {
    ctx.reply(`❌ Error: ${err.message}`);
  }
});

// === Escaneo periódico cada hora ===
setInterval(async () => {
  try {
    const evm = await scanEvm(config.wallets.evm[0]);
    const ton = await scanTon(config.wallets.ton[0]);
    await bot.telegram.sendMessage(
      config.adminId,
      `⏰ Escaneo automático:\nEVM: ${evm.eth || 0} ETH\nTON: ${ton.ton || 0} TON`
    );
  } catch (err) {
    console.error("Error auto-scan:", err.message);
  }
}, 60 * 60 * 1000);

// === Reporte diario 09:00 ===
cron.schedule("0 9 * * *", async () => {
  try {
    const evm = await scanEvm(config.wallets.evm[0]);
    const ton = await scanTon(config.wallets.ton[0]);
    await bot.telegram.sendMessage(
      config.adminId,
      `📊 Reporte diario:\nEVM: ${evm.eth || 0} ETH\nTON: ${ton.ton || 0} TON`
    );
  } catch (err) {
    console.error("Error reporte diario:", err.message);
  }
});

// === 🔁 Cambiamos de polling a webhook (modo producción) ===
const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/bot${config.botToken}`;
const DOMAIN = process.env.DOMAIN || process.env.RAILWAY_STATIC_URL || "https://crybot.up.railway.app";
const WEBHOOK_URL = `${DOMAIN}${WEBHOOK_PATH}`;

// Middleware de Telegram
app.use(bot.webhookCallback(WEBHOOK_PATH));

// Configurar webhook en Telegram
bot.telegram.setWebhook(WEBHOOK_URL)
  .then(() => console.log(`🌐 Webhook configurado en: ${WEBHOOK_URL}`))
  .catch((err) => console.error("❌ Error configurando webhook:", err.message));

// Endpoint simple para verificar estado
app.get("/", (_, res) => res.send("✅ CryBot webhook activo y escuchando."));

// Iniciar servidor Express
app.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP en puerto ${PORT}`);
  console.log(`🌍 Esperando updates desde Telegram...`);
});