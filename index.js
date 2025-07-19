require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const token = process.env.BOT_TOKEN;
const port = process.env.PORT || 3000;
const url = process.env.WEBHOOK_URL; // Should be your public URL

const bot = new TelegramBot(token, { webHook: { port } });

const app = express();
app.use(express.json());

// Endpoint that telegram will call
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Set webhook
if (url) {
  bot.setWebHook(`${url}/bot${token}`);
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🤖 Bienvenido a CryBot. Escribe /saldo para ver tu wallet.');
});

bot.onText(/\/saldo/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🔍 Consultando tu saldo... (simulado)');
});

app.listen(port, () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
