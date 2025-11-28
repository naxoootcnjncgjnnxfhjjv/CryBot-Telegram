import { Telegraf } from "telegraf";
import { BOT_TOKEN } from "./config/keys.js";
import { scanAll } from "./modules/scan/scan_all.js";
import { sellAll } from "./modules/sell/sell_all.js";
import { claimAll } from "./modules/claim/claim_all.js";
import { farmAll } from "./modules/farm/farm_all.js";

// Initialize the Telegraf bot with the provided token.
export const bot = new Telegraf(BOT_TOKEN);

// Define commands that can be invoked from Telegram.
bot.command("start", ctx => ctx.reply("CryBot operativo. Listo para generar dinero."));
bot.command("scan_all", async ctx => ctx.reply(await scanAll()));
bot.command("sell_all", async ctx => ctx.reply(await sellAll()));
bot.command("claim_all", async ctx => ctx.reply(await claimAll()));
bot.command("farm_all", async ctx => ctx.reply(await farmAll()));
bot.command("status", ctx => ctx.reply("CryBot funcionando 24/7 🔥"));
