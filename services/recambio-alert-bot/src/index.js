const path = require("path");
const http = require("http");
const { createLogger } = require("./lib/logger");
const { readJson, writeJsonAtomic, StateStore } = require("./lib/state");
const { TelegramClient, sleep } = require("./lib/telegram");
const { scrapeEbay } = require("./lib/scrapers/ebay");
const { scrapeAutodoc } = require("./lib/scrapers/autodoc");

const ROOT = path.resolve(__dirname, "..");
const PARTS_FILE = path.join(ROOT, "parts.json");
const PARTS_RUNTIME_FILE = path.join(ROOT, "parts.runtime.json");
const STATE_FILE = path.join(ROOT, "state.json");

const config = {
  botToken: process.env.BOT_TOKEN,
  chatId: process.env.CHAT_ID,
  intervalMinutes: Number(process.env.INTERVAL_MINUTES || 30),
  dropEur: Number(process.env.DROP_EUR || 5),
  maxResults: Number(process.env.MAX_RESULTS || 15),
  headless: `${process.env.HEADLESS || "true"}` !== "false",
  logLevel: process.env.LOG_LEVEL || "info",
  userAgent: process.env.USER_AGENT || "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  proxyUrl: process.env.PROXY_URL,
  ebayDomain: process.env.EBAY_DOMAIN || "ebay.es",
  strictOEM: `${process.env.STRICT_OEM || "true"}` !== "false",
  port: process.env.PORT ? Number(process.env.PORT) : null
};

const logger = createLogger(config.logLevel);

if (!config.botToken || !config.chatId) {
  logger.error("config_missing", { message: "BOT_TOKEN and CHAT_ID are required" });
  process.exit(1);
}

const stateStore = new StateStore(STATE_FILE);
const telegram = new TelegramClient({ token: config.botToken, chatId: config.chatId, logger });

const runtime = {
  parts: [],
  isRunning: false,
  healthy: true,
  ready: false,
  failures: 0,
  nextDelayMs: config.intervalMinutes * 60_000
};

async function loadParts() {
  const base = await readJson(PARTS_FILE, []);
  const existingRuntime = await readJson(PARTS_RUNTIME_FILE, null);
  if (!existingRuntime) {
    await writeJsonAtomic(PARTS_RUNTIME_FILE, base);
    runtime.parts = base;
  } else {
    runtime.parts = existingRuntime;
  }
}

async function persistParts() {
  await writeJsonAtomic(PARTS_RUNTIME_FILE, runtime.parts);
}

function normalizePart(part) {
  return {
    ref: String(part.ref || "").trim(),
    keywords: Array.isArray(part.keywords)
      ? part.keywords.map((k) => String(k).trim()).filter(Boolean)
      : String(part.keywords || "").split(",").map((k) => k.trim()).filter(Boolean)
  };
}

function partKey(part) {
  return `${part.ref}::${(part.keywords || []).join("|")}`;
}

function formatOffer(offer) {
  return `€${offer.total.toFixed(2)} (artículo €${offer.price.toFixed(2)} + envío €${offer.shipping.toFixed(2)})\n${offer.title}\n${offer.link}`;
}

async function processPart(part) {
  const key = partKey(part);
  const prev = stateStore.get(key) || {};

  const withTimeout = (promise, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout`)), 45000))
  ]);

  let ebay;
  let autodoc;
  ebay = await withTimeout(scrapeEbay(part, config, logger), "ebay");
  autodoc = await withTimeout(scrapeAutodoc(part, config, logger), "autodoc").catch((err) => {
    logger.warn("autodoc_best_effort_failed", { ref: part.ref, err });
    return { source: "autodoc", offers: [], best: null };
  });

  const best = ebay.best || autodoc.best || null;

  const hadStockBefore = Boolean(prev.hadStock);
  const hasStockNow = Boolean(best);

  const messages = [];

  if (best && !prev.firstSeenAt) {
    messages.push(`🆕 Primera detección para ${part.ref}\n${formatOffer(best)}`);
  }

  if (best && prev.bestTotal !== undefined && prev.bestTotal !== null && (prev.bestTotal - best.total) >= config.dropEur) {
    messages.push(`📉 Bajada de precio >= €${config.dropEur} para ${part.ref}\nAntes: €${prev.bestTotal.toFixed(2)}\nAhora: €${best.total.toFixed(2)}\n${best.link}`);
  }

  if (best && prev.bestLink && prev.bestLink !== best.link) {
    messages.push(`🔄 Cambio de mejor oferta para ${part.ref}\n${formatOffer(best)}`);
  }

  if (best && !hadStockBefore && hasStockNow && prev.firstSeenAt) {
    messages.push(`✅ Vuelve stock para ${part.ref}\n${formatOffer(best)}`);
  }

  const nextState = {
    ref: part.ref,
    keywords: part.keywords,
    firstSeenAt: prev.firstSeenAt || (best ? new Date().toISOString() : null),
    lastCheckAt: new Date().toISOString(),
    hadStock: hasStockNow,
    bestTotal: best ? best.total : null,
    bestLink: best ? best.link : null,
    bestTitle: best ? best.title : null,
    lastAlertHash: prev.lastAlertHash || null
  };

  const alertHash = messages.join("\n---\n");
  if (messages.length && prev.lastAlertHash !== alertHash) {
    for (const msg of messages) {
      await telegram.sendMessage(msg);
      await sleep(350);
    }
    nextState.lastAlertHash = alertHash;
  }

  stateStore.set(key, nextState);
}

async function checkAllParts(reason = "scheduled") {
  if (runtime.isRunning) {
    logger.warn("check_skipped_already_running", { reason });
    return;
  }

  runtime.isRunning = true;
  runtime.ready = false;
  logger.info("check_started", { reason, parts: runtime.parts.length });

  try {
    for (const raw of runtime.parts) {
      const part = normalizePart(raw);
      if (!part.ref) continue;
      await processPart(part);
    }
    await stateStore.save();
    runtime.failures = 0;
    runtime.nextDelayMs = config.intervalMinutes * 60_000;
    runtime.healthy = true;
    logger.info("check_finished", { reason });
  } catch (err) {
    runtime.failures += 1;
    runtime.healthy = false;
    const backoff = [60_000, 5 * 60_000, 15 * 60_000];
    runtime.nextDelayMs = backoff[Math.min(runtime.failures - 1, backoff.length - 1)];
    logger.error("check_failed", { reason, failures: runtime.failures, nextDelayMs: runtime.nextDelayMs, err });

    if (runtime.failures === 1) {
      await telegram.sendMessage(`⚠️ Fallo de scraping. Reintento en ${Math.round(runtime.nextDelayMs / 60000)} min.`);
    }
  } finally {
    runtime.isRunning = false;
    runtime.ready = true;
  }
}

function startHealthServer() {
  if (!config.port) return;

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(runtime.healthy ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: runtime.healthy ? "ok" : "degraded" }));
      return;
    }
    if (req.url === "/ready") {
      res.writeHead(runtime.ready ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: runtime.ready ? "ready" : "not_ready" }));
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  server.listen(config.port, () => logger.info("health_server_started", { port: config.port }));
}

function installProcessGuards() {
  process.on("unhandledRejection", (err) => logger.error("unhandled_rejection", { err }));
  process.on("uncaughtException", (err) => logger.error("uncaught_exception", { err }));
}

async function telegramCommandsLoop() {
  while (true) {
    try {
      const updates = await telegram.getUpdates();
      for (const update of updates) {
        telegram.consumeUpdate(update);
        const text = update?.message?.text || "";
        const chatId = String(update?.message?.chat?.id || "");
        if (!text || chatId !== String(config.chatId)) continue;

        const [cmd, ...rest] = text.trim().split(/\s+/);

        if (cmd === "/start") {
          await telegram.sendMessage("✅ RecambioAlertBot activo. Usa /run, /list, /add, /remove");
        } else if (cmd === "/run") {
          await telegram.sendMessage("⏱ Ejecutando check manual...");
          checkAllParts("manual").catch((err) => logger.error("manual_check_failed", { err }));
        } else if (cmd === "/list") {
          const body = runtime.parts.map((p) => `• ${p.ref} | ${(p.keywords || []).join(", ")}`).join("\n") || "(sin referencias)";
          await telegram.sendMessage(`📦 Referencias:\n${body}`);
        } else if (cmd === "/add") {
          const ref = (rest.shift() || "").trim();
          if (!ref) { await telegram.sendMessage("Uso: /add <REF> <keywords opcionales>"); continue; }
          const keywords = rest;
          const part = normalizePart({ ref, keywords: keywords.length ? keywords : ["genuine", "original", "OEM", "Lexus", "Toyota"] });
          const exists = runtime.parts.some((p) => String(p.ref).toLowerCase() === part.ref.toLowerCase());
          if (exists) { await telegram.sendMessage(`ℹ️ ${part.ref} ya existe.`); continue; }
          runtime.parts.push(part);
          await persistParts();
          await telegram.sendMessage(`✅ Añadida ${part.ref}.`);
        } else if (cmd === "/remove") {
          const ref = (rest.shift() || "").trim();
          const before = runtime.parts.length;
          runtime.parts = runtime.parts.filter((p) => String(p.ref).toLowerCase() !== ref.toLowerCase());
          if (runtime.parts.length === before) await telegram.sendMessage(`ℹ️ ${ref || "(vacío)"} no encontrada.`);
          else { await persistParts(); await telegram.sendMessage(`🗑 Eliminada ${ref}.`); }
        }
      }
    } catch (err) {
      logger.warn("telegram_loop_error", { err });
      await sleep(2000);
    }
  }
}

async function startScheduler() {
  await stateStore.load();
  await loadParts();
  await checkAllParts("startup");

  (async function loop() {
    await sleep(runtime.nextDelayMs);
    await checkAllParts("scheduled");
    loop().catch((err) => logger.error("scheduler_loop_failed", { err }));
  })();
}

(async function main() {
  installProcessGuards();
  startHealthServer();
  startScheduler().catch((err) => logger.error("scheduler_failed", { err }));
  telegramCommandsLoop().catch((err) => logger.error("telegram_loop_failed", { err }));
})();
