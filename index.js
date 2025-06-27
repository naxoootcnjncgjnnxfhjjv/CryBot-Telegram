require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

// Token proporcionado por el usuario
const token = '7814370529:AAEEqPSTv1QVHxNCu8EJE4iAvp-bvxYtHaY';

const bot = new TelegramBot(token);

const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.onText(/\/start/, (msg) => {
  const text = '👋 Hola, soy CryBot. Estoy listo para ayudarte con tus airdrops.';
  bot.sendMessage(msg.chat.id, text);
});

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';

if (WEBHOOK_URL) {
  bot.setWebHook(`${WEBHOOK_URL}/webhook`);
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
