/*
 * Main entrypoint for CryBot on Railway.
 *
 * This file uses the Telegraf library to interact with the Telegram Bot API
 * and Express to expose a webhook endpoint. The bot can run in two modes:
 *  - Webhook mode: If the `WEBHOOK_DOMAIN` environment variable is set,
 *    the application will automatically register a webhook on start up
 *    pointing at `<WEBHOOK_DOMAIN>/webhook`. Railway will invoke this route
 *    whenever Telegram sends an update. This is the recommended mode for
 *    cloud deployments.
 *  - Polling mode: If `WEBHOOK_DOMAIN` is not defined, the bot falls back
 *    to long polling with `bot.launch()`. This is useful for local
 *    development.
 *
 * Environment variables consumed:
 *  - BOT_TOKEN (required): The secret token from BotFather for your bot.
 *  - WEBHOOK_DOMAIN (optional): The base URL of your deployed service
 *    without a trailing slash, e.g. `https://crybot-production.up.railway.app`.
 *  - PORT (optional): The port Express should listen on. Railway will
 *    automatically assign this for deployed instances.
 */

import "dotenv/config";
import { Telegraf } from "telegraf";
import express from "express";

// Retrieve your bot token from environment variables
const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error(
    "BOT_TOKEN is not defined. Please set it in your Railway variables or .env file."
  );
}

// Initialize the bot
const bot = new Telegraf(token);

// Example command handlers – customise these to suit your bot's behaviour
bot.command("start", (ctx) => ctx.reply("¡Hola! CryBot está operativo."));
bot.command("help", (ctx) => ctx.reply("Envíame un mensaje y lo repetiré."));
bot.on("text", (ctx) => ctx.reply(`Eco: ${ctx.message.text}`));

// Create an Express application
const app = express();
app.use(express.json());

// Healthcheck endpoint – Railway will poll this to determine service health
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

// Path at which Telegram will POST updates
const WEBHOOK_PATH = "/webhook";

// Webhook handler
app.post(WEBHOOK_PATH, async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
  } catch (err) {
    console.error("Error handling update:", err);
  } finally {
    // Always return a 200 status to acknowledge receipt to Telegram
    res.status(200).end();
  }
});

// Determine port
const PORT = process.env.PORT || 3000;

// Start the Express server
app.listen(PORT, async () => {
  console.log(`CryBot listening on port ${PORT}`);

  const domain = process.env.WEBHOOK_DOMAIN;
  if (domain) {
    // Register webhook with Telegram
    const url = `${domain}${WEBHOOK_PATH}`;
    try {
      await bot.telegram.setWebhook(url);
      console.log(`Webhook registered: ${url}`);
    } catch (err) {
      console.error("Failed to set webhook:", err);
    }
  } else {
    // Fallback to polling if no domain is provided
    console.warn(
      "WEBHOOK_DOMAIN is not set; falling back to long polling (not recommended for production)."
    );
    await bot.launch();
  }
});

// Graceful shutdown – stop polling when the process is terminating
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));