require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

// Token desde .env
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);

// Express App
const app = express();
app.use(express.json());

// Endpoint para recibir mensajes desde Telegram
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Comando /start
bot.onText(/\/start/, (msg) => {
  const text = '👋 Hola, soy CryBot. Estoy listo para ayudarte.';
  bot.sendMessage(msg.chat.id, text);
});

// Configurar webhook si hay URL
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (WEBHOOK_URL) {
  bot.setWebHook(`${WEBHOOK_URL}/webhook`);
  console.log('✅ Webhook configurado:', `${WEBHOOK_URL}/webhook`);
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
