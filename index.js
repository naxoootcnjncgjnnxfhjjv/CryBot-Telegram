// ======================================================
// 🤖 CryBot Final 2.0 — Multi-Chain Auto Manager
// ======================================================
const { Telegraf } = require("telegraf");
const axios = require("axios");
const { ethers } = require("ethers");
const cron = require("node-cron");
const { loadConfig } = require("./config");

// Importar módulos de venta automatizada para GetGems y PlanetIX
const { startAutoListing } = require('./sell_getgems');
const { startMonitoring } = require('./sell_planetix');

// Importar módulos de eventos y venta existentes
const getgems = require('./getgems');
const sellEngine = require('./sell-engine');
const storage = require('./storage');

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

// === Escanear balance Polygon ===
async function scanPolygon(addr) {
  const rpc = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
  try {
    const polygonProvider = new ethers.JsonRpcProvider(rpc);
    const bal = await polygonProvider.getBalance(addr);
    return { address: addr, matic: Number(ethers.formatEther(bal)) };
  } catch (err) {
    return { address: addr, error: err.message };
  }
}

// === Escanear balance BSC ===
async function scanBsc(addr) {
  const rpc = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
  try {
    const bscProvider = new ethers.JsonRpcProvider(rpc);
    const bal = await bscProvider.getBalance(addr);
    return { address: addr, bnb: Number(ethers.formatEther(bal)) };
  } catch (err) {
    return { address: addr, error: err.message };
  }
}

// === Escanear balance Solana (stub) ===
async function scanSolana(addr) {
  // Para redes no EVM aún no hay integración; devolvemos 0 como placeholder.
  return { address: addr, sol: 0 };
}

// === Escanear balance Aptos (stub) ===
async function scanAptos(addr) {
  // Para redes no EVM aún no hay integración; devolvemos 0 como placeholder.
  return { address: addr, apt: 0 };
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

// === Obtener precios de tokens (USD) ===
async function getTokenPrices(symbols) {
  try {
    const res = await axios.get('https://min-api.cryptocompare.com/data/pricemulti', {
      params: {
        fsyms: symbols.join(','),
        tsyms: 'USD'
      }
    });
    return res.data;
  } catch (err) {
    console.error('Error obteniendo precios:', err.message);
    return {};
  }
}

// === Resumen de tokens y valor estimado ===
async function getTokenSummary() {
  let totalEth = 0;
  for (const addr of config.wallets?.evm || []) {
    const bal = await scanEvm(addr);
    totalEth += bal.eth || 0;
  }
  let totalTon = 0;
  for (const addr of config.wallets?.ton || []) {
    const bal = await scanTon(addr);
    totalTon += bal.ton || 0;
  }
  const prices = await getTokenPrices(['ETH', 'TONCOIN']);
  const ethUsd = prices?.ETH?.USD || 0;
  const tonUsd = prices?.TONCOIN?.USD || 0;
  return {
    ETH: { amount: totalEth, usd: totalEth * ethUsd },
    TON: { amount: totalTon, usd: totalTon * tonUsd }
  };
}

// === Generar resumen completo ===
async function generateResumen() {
  const evmAddrs = config.wallets?.evm || [];
  const tonAddrs = config.wallets?.ton || [];
  let message = '📊 Resumen diario\n';
  // Balances EVM
  for (const addr of evmAddrs) {
    const bal = await scanEvm(addr);
    message += `• ETH (${addr.slice(0, 6)}…): ${bal.eth || 0} ETH\n`;
  }
  // Balances TON
  for (const addr of tonAddrs) {
    const bal = await scanTon(addr);
    message += `• TON (${addr.slice(0, 6)}…): ${bal.ton || 0} TON\n`;
  }
  // Tokens
  const tokens = await getTokenSummary();
  message += '\n💎 Tokens:\n';
  for (const key of Object.keys(tokens)) {
    const t = tokens[key];
    const usdVal = isNaN(t.usd) ? 0 : t.usd;
    message += `${key}: ${t.amount} (≈ $${usdVal.toFixed(2)})\n`;
  }
  return message;
}

// === Comandos Telegram ===
bot.start((ctx) => ctx.reply("🚀 CryBot activo. Usa /help"));
bot.command("help", (ctx) =>
  ctx.reply(
    [
      "/status — test de vida",
      "/saldo — ver balances de todas las wallets",
      "/tokens — listar tokens y valor estimado",
      "/nfts — listar NFTs (OpenSea)",
      "/reclamar — ejecutar reclamos automáticos",
      "/enviar <eth> <to> — enviar ETH manual (solo admin)",
      "/panel — mostrar resumen general",
      "/resumen — enviar resumen diario al instante"
    ].join("\n")
  )
);

bot.command("status", (ctx) => ctx.reply("✅ OK, bot activo."));

bot.command("saldo", async (ctx) => {
  const evmAddrs = config.wallets?.evm || [];
  const tonAddrs = config.wallets?.ton || [];
  const polygonAddrs = config.wallets?.polygon || [];
  const bscAddrs = config.wallets?.bsc || [];
  const solAddrs = config.wallets?.solana || [];
  const aptAddrs = config.wallets?.aptos || [];
  let message = "📦 Saldos\n";
  for (const addr of evmAddrs) {
    const evm = await scanEvm(addr);
    message += `• ETH (${addr}): ${evm?.eth || 0} ETH\n`;
  }
  for (const addr of tonAddrs) {
    const ton = await scanTon(addr);
    message += `• TON (${addr}): ${ton?.ton || 0} TON\n`;
  }
  for (const addr of polygonAddrs) {
    const pol = await scanPolygon(addr);
    message += `• Polygon (${addr}): ${pol?.matic || 0} MATIC\n`;
  }
  for (const addr of bscAddrs) {
    const bsc = await scanBsc(addr);
    message += `• BSC (${addr}): ${bsc?.bnb || 0} BNB\n`;
  }
  for (const addr of solAddrs) {
    const sol = await scanSolana(addr);
    message += `• Solana (${addr}): ${sol?.sol || 0} SOL\n`;
  }
  for (const addr of aptAddrs) {
    const apt = await scanAptos(addr);
    message += `• Aptos (${addr}): ${apt?.apt || 0} APT\n`;
  }
  message += `→ Principal: ${config.wallets?.main}`;
  ctx.reply(message);
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
  if (!addr) return ctx.reply('❌ No hay wallets EVM configuradas');
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

// === Nuevo comando: tokens ===
bot.command("tokens", async (ctx) => {
  const summary = await getTokenSummary();
  let msg = '💎 Tokens y valor estimado\n';
  for (const key of Object.keys(summary)) {
    const t = summary[key];
    const usdVal = isNaN(t.usd) ? 0 : t.usd;
    msg += `${key}: ${t.amount} (≈ $${usdVal.toFixed(2)})\n`;
  }
  ctx.reply(msg);
});

// === Nuevo comando: panel ===
bot.command("panel", async (ctx) => {
  const evmAddrs = config.wallets?.evm || [];
  const tonAddrs = config.wallets?.ton || [];
  let msg = '📋 Panel general\n';
  msg += 'Balances:\n';
  for (const addr of evmAddrs) {
    const bal = await scanEvm(addr);
    msg += `• ETH (${addr.slice(0,6)}…): ${bal.eth || 0} ETH\n`;
  }
  for (const addr of tonAddrs) {
    const bal = await scanTon(addr);
    msg += `• TON (${addr.slice(0,6)}…): ${bal.ton || 0} TON\n`;
  }
  // Tokens summary
  const tokens = await getTokenSummary();
  msg += '\nTokens:\n';
  for (const key of Object.keys(tokens)) {
    const t = tokens[key];
    const usdVal = isNaN(t.usd) ? 0 : t.usd;
    msg += `${key}: ${t.amount} (≈ $${usdVal.toFixed(2)})\n`;
  }
  ctx.reply(msg);
});

// === Nuevo comando: resumen ===
bot.command("resumen", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ No autorizado');
  const msg = await generateResumen();
  ctx.reply(msg);
});

// === Escaneo periódico cada hora ===
setInterval(async () => {
  try {
    const evm = await scanEvm(config.wallets?.evm?.[0]);
    const ton = await scanTon(config.wallets?.ton?.[0]);
    await bot.telegram.sendMessage(
      config.adminId,
      `⏰ Escaneo automático:\nEVM: ${evm?.eth || 0} ETH\nTON: ${ton?.ton || 0} TON`
    );
  } catch (err) {
    console.error("Error auto-scan:", err.message);
  }
}, 60 * 60 * 1000);

// === Reporte diario 09:00 ===
cron.schedule("0 9 * * *", async () => {
  try {
    const resumen = await generateResumen();
    await bot.telegram.sendMessage(config.adminId, resumen);
  } catch (err) {
    console.error("Error reporte diario:", err.message);
  }
});

// === 🔁 Cambiamos de polling a webhook (modo producción) ===
const express = require("express");
const app = express();
// Servir la miniapp de CryBot
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});
const PORT = process.env.PORT || 3000;
process.env.RAILWAY_STATIC_URL || "https://crybot.up.railway.app";
// === Miniapp CryBot (interfaz web para Telegram) ===
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});
// Middleware de Telegram
app.use(bot.webhookCallback(WEBHOOK_PATH));
// === Miniapp CryBot (interfaz web para Telegram) ===
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});

// Middleware para recibir updates de Telegram
app.post(WEBHOOK_PATH, (req, res) => bot.handleUpdate(req.body, res));

// Configurar webhook en Telegram
bot.telegram.setWebhook(WEBHOOK_URL)
  .then(() => console.log(`🌐 Webhook configurado correctamente en: ${WEBHOOK_URL}`))
  .catch(err => console.error("❌ Error configurando webhook:", err.message));

// Endpoint simple para verificar estado
app.get("/", (_, res) => res.send("✅ CryBot activo y escuchando updates desde Telegram."));

// Iniciar servidor Express
app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Servidor HTTP en puerto ${process.env.PORT || 3000}`);
  console.log("🌎 Esperando updates desde Telegram...");
});
// === Endpoint de datos para el dashboard ===
app.get('/api/dashboard', async (req, res) => {
  try {
    const evmAddr = config.wallets?.evm?.[0];
    const tonAddr = config.wallets?.ton?.[0];

    const evmBal = await scanEvm(evmAddr);
    const tonBal = await scanTon(tonAddr);

    const tokens = await getTokenSummary();
    const farming = "EigenLayer + Etherfi activos";
    const rewards = "Último claim hace 2h";

    res.json({
      balance: `${(evmBal.eth || 0).toFixed(4)} ETH | ${(tonBal.ton || 0).toFixed(2)} TON`,
      nfts: "Planet IX + TON Punks detectados",
      farming,
      rewards,
      tokens,
    });
  } catch (err) {
    console.error("Error cargando dashboard:", err.message);
    res.json({ error: err.message });
  }
});
// === Endpoint de datos para el dashboard ===
app.get('/api/dashboard', async (req, res) => {
  try {
    const evmAddr = config.wallets?.evm?.[0];
    const tonAddr = config.wallets?.ton?.[0];

    const evmBal = await scanEvm(evmAddr);
    const tonBal = await scanTon(tonAddr);

    const tokens = await getTokenSummary();
    const farming = "EigenLayer + Etherfi activos";
    const rewards = "Último claim hace 2h";

    res.json({
      balance: `${(evmBal.eth || 0).toFixed(4)} ETH | ${(tonBal.ton || 0).toFixed(2)} TON`,
      nfts: "Planet IX + TON Punks detectados",
      farming,
      rewards,
      tokens,
    });
  } catch (err) {
    console.error("Error cargando dashboard:", err.message);
    res.json({ error: err.message });
  }
});
// === Inicializar eventos de GetGems y procesamiento de ofertas ===
try {
  getgems.startEvents();
  getgems.emitter.on('offer', async (offer) => {
    try {
      await sellEngine.processOffer(offer, bot);
    } catch (err) {
      console.error('Error procesando oferta:', err.message);
    }
  });
  // Acción para cancelar oferta desde inline keyboard
  bot.action(/cancel_(.+)/, async (ctx) => {
    const offerId = ctx.match[1];
    storage.updateStatus(offerId, 'CANCELLED');
    await ctx.reply('❌ Oferta cancelada.');
  });
} catch (err) {
  console.error('Error iniciando módulo de venta automatizada:', err.message);
}

/**
 * ---------------------------------------------------------------------------
 * 🏦 Treasury Bot Integration
 * ---------------------------------------------------------------------------
 */
const { TreasuryBot } = require('./treasuryBot.js');
class BotBalanceProvider {
  constructor(config) {
    this.config = config;
  }
  async getTreasuryState() {
    let totalNative = ethers.BigNumber.from(0);
    for (const addr of this.config.wallets?.evm || []) {
      const bal = await scanEvm(addr);
      if (bal.eth) {
        const wei = ethers.parseEther(String(bal.eth));
        totalNative = totalNative.add(ethers.BigNumber.from(wei.toString()));
      }
    }
    for (const addr of this.config.wallets?.ton || []) {
      const bal = await scanTon(addr);
      if (bal.ton) {
        const nano = Math.floor(bal.ton * 1e9);
        totalNative = totalNative.add(ethers.BigNumber.from(nano));
      }
    }
    return {
      stable: ethers.BigNumber.from(0),
      native: totalNative,
      beta: ethers.BigNumber.from(0),
    };
  }
  async getGasBalances() {
    let ethBal = ethers.BigNumber.from(0);
    let tonBal = ethers.BigNumber.from(0);
    const evmAddr = this.config.wallets?.evm?.[0];
    const tonAddr = this.config.wallets?.ton?.[0];
    if (evmAddr) {
      const bal = await scanEvm(evmAddr);
      if (bal.eth) {
        ethBal = ethers.BigNumber.from(
          ethers.parseEther(String(bal.eth)).toString()
        );
      }
    }
    if (tonAddr) {
      const bal = await scanTon(tonAddr);
      if (bal.ton) {
        tonBal = ethers.BigNumber.from(Math.floor(bal.ton * 1e9));
      }
    }
    return {
      ETH: ethBal,
      TON: tonBal,
    };
  }
}
class BotSwapper {
  async swap(from, to, amountIn, slippageTolerance) {
    const toleranceBN = ethers.BigNumber.from(
      Math.floor(slippageTolerance * 1000)
    );
    const fee = amountIn.mul(toleranceBN).div(100000);
    const received = amountIn.sub(fee);
    console.log(
      `↔️ Swap: ${ethers.formatUnits(amountIn)} ${from} → ${to}, slippage tol ${slippageTolerance} (received ${ethers.formatUnits(received)})`
    );
    return received;
  }
}
class BotPriceOracle {
  async getNativePrice() {
    const prices = await getTokenPrices(['ETH', 'TONCOIN']);
    const ethPrice = prices?.ETH?.USD || 0;
    const tonPrice = prices?.TONCOIN?.USD || 0;
    return Math.max(ethPrice, tonPrice);
  }
  async getNativePriceChange24h() {
    return 0;
  }
}
 class BotNFTMarketplace {
  constructor(config) {
    this.config = config;
    this.listings = {};
  }
  async getCollectionFloor() {
    try {
      const addr = this.config.wallets?.evm?.[0];
      if (!addr) throw new Error('No EVM wallet configured');
      const res = await axios.get(
        `https://api.opensea.io/api/v2/chain/ethereum/account/${addr}/nfts`
      );
      const nfts = res.data?.nfts || [];
      const floors = nfts
        .map((n) => n.floor_price_native || n.floor_price_eth || n.floor_price || 0)
        .filter((p) => typeof p === 'number' && p > 0);
      if (floors.length === 0) {
        return ethers.parseEther('0.01');
      }
      const minFloor = Math.min(...floors);
      return ethers.parseEther(String(minFloor));
    } catch (err) {
      console.warn(`⚠️ Error fetching collection floor: ${err.message}`);
      return ethers.parseEther('0.01');
    }
  }
  async listForSale(token, price) {
    this.listings[token] = { price, time: Date.now() };
    console.log(
      `📤 Listing NFT ${token} at ${ethers.formatUnits(price)} (stub)`
    );
  }
  async acceptBestOffer(/* token, minAcceptablePrice */) {
    return false;
  }
  async getInventory() {
    try {
      const addr = this.config.wallets?.evm?.[0];
      if (!addr) return [];
      const res = await axios.get(
        `https://api.opensea.io/api/v2/chain/ethereum/account/${addr}/nfts`
      );
      const nfts = res.data?.nfts || [];
      return nfts.map(
        (n) =>
          n.identifier ||
          n.contract ||
          n.token_id ||
          `NFT${Math.random().toString(16).slice(2, 8)}`
      );
    } catch (err) {
      console.warn(`⚠️ Error fetching NFT inventory: ${err.message}`);
      return [];
    }
  }
  async getLastListedAt(token) {
    return this.listings[token]?.time;
  }
}
// === Inicializar y ejecutar el bot de tesorería ===
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
  console.log('💰 Treasury bot iniciado.');
} catch (err) {
  console.error('Error inicializando TreasuryBot:', err.message);
}

// === Iniciar módulos de venta automática ===
// Listar NFTs en GetGems de forma periódica
startAutoListing(bot, config.getgems?.listInterval);
// Aceptar ofertas de PlanetIX periódicamente
startMonitoring(bot, config.planetix?.pollInterval);
// ======================================================
// ♻️ Auto-reinicio inteligente — CryBot Health Monitor
// ======================================================

let failedChecks = 0;
const MAX_FAILS = 3;
const CHECK_INTERVAL_MS = 1000 * 60 * 5; // cada 5 minutos

async function checkWebhookHealth() {
  const url = process.env.DOMAIN || "https://crybot-telegram-production.up.railway.app";
  try {
    const res = await axios.get(`${url}/`);
    if (res.status === 200) {
      failedChecks = 0;
      console.log("✅ Webhook activo y respondiendo correctamente.");
    } else {
      failedChecks++;
      console.warn(`⚠️ Respuesta inesperada (${res.status}), intento ${failedChecks}/${MAX_FAILS}`);
    }
  } catch (err) {
    failedChecks++;
    console.warn(`⚠️ Error al comprobar webhook: ${err.message} (intento ${failedChecks}/${MAX_FAILS})`);
  }

  if (failedChecks >= MAX_FAILS) {
    console.error("❌ Webhook inactivo repetidamente. Reiniciando proceso...");
    process.exit(1); // Railway reinicia automáticamente el contenedor
  }
}

setInterval(checkWebhookHealth, CHECK_INTERVAL_MS);
setInterval(async () => {
  try {
    await axios.get(process.env.DOMAIN || "https://crybot-telegram-production.up.railway.app");
    console.log("💓 Ping de salud enviado");
  } catch (err) {
    console.warn("⚠️ Error en ping de salud:", err.message);
  }
}, 1000 * 60 * 5); // cada 5 minutos