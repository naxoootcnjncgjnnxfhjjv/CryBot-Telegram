// ======================================================
// CryBot Nucleo - Webhook + Express (Railway ready)
// ======================================================

require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');

// 1. Comprobacion de variables criticas
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN no definido. Configuralo en Railway.');
  process.exit(1);
}

const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook';
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || process.env.RAILWAY_STATIC_URL; // ej: https://crybot.up.railway.app
const bot = new Telegraf(BOT_TOKEN);

// Comandos basicos para probar
bot.start((ctx) => {
  ctx.reply('CryBot online.\nPrueba /ping o /saldo.');
});

bot.command('ping', (ctx) => {
  ctx.reply('pong');
});

bot.command('saldo', async (ctx) => {
  await ctx.reply('Modulo de saldo conectado. (Dummy por ahora)');
});

// 3. Express + Webhook
const app = express();
app.use(express.json());

// Ruta de webhook que Telegram llamara
app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// Healthcheck para Railway
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// Raiz para comprobar que el server vive
app.get('/', (_req, res) => {
  res.status(200).send('CryBot server OK');
});

// 4. Arrancar servidor
app.listen(PORT, async () => {
  console.log('Server funcionando en el puerto ' + PORT);
  if (BASE_URL) {
    try {
      await bot.telegram.setWebhook(BASE_URL + WEBHOOK_PATH);
      console.log('Webhook configurado con exito');
    } catch (err) {
      console.error('Error al configurar el webhook:', err.message);
    }
  } else {
    console.warn('BASE_URL no definido. El webhook no se configurara automaticamente.');
  }
});  
