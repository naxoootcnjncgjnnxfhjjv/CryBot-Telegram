require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { Web3 } = require("web3");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const web3 = new Web3("https://cloudflare-eth.com");

bot.onText(/\/start/, (msg) => {
  const text =
    "🤖 Bienvenido a CryBot. Envía /saldo <wallet> para consultar el balance de una dirección.";
  bot.sendMessage(msg.chat.id, text);
});

bot.onText(/\/saldo (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const address = match[1].trim();

  if (!web3.utils.isAddress(address)) {
    bot.sendMessage(chatId, "❌ Dirección de wallet inválida.");
    return;
  }

  try {
    const balanceWei = await web3.eth.getBalance(address);
    const balanceEth = web3.utils.fromWei(balanceWei, "ether");
    bot.sendMessage(chatId, `💰 Balance de ${address}: ${balanceEth} ETH`);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "⚠️ Error al consultar el saldo.");
  }
});
