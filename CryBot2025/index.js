import "./config/keys.js";
import { bot } from "./bot.js";
import { startCronJobs } from "./modules/utils/cron.js";

// Entry point for CryBot.
// Loads environment variables, launches the Telegram bot, and starts
// automated cron jobs for scanning, claiming, selling and farming.
console.log("🚀 CryBot arrancando...");

// Launch the Telegram bot.
bot.launch().then(() => console.log("🤖 CryBot ONLINE en Telegram"));

// Begin recurring tasks (scan, claim, sell, farm).
startCronJobs();
