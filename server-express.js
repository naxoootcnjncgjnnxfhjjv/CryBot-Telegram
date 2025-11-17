require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const { loadConfig } = require('./config');
const tonService = require('../services/tonService');
const planetixService = require('../services/planetixService');

// Cargar configuración y servicios
const config = loadConfig();

// Comprobar variables críticas
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN no definido. Configúralo en Railway o en tu .env');
  process.exit(1);
}

// Inicializar bot de Telegram
const bot = new Telegraf(BOT_TOKEN);

// Configurar notificaciones (Telegram)
let userChatId = null;

async function notify(message) {
  if (!userChatId) return;
  try {
    await bot.telegram.sendMessage(userChatId, message);
  } catch (err) {
    console.error('Error enviando notificación por Telegram:', err.message);
  }
}

// Configurar notifiers en servicios
tonService.setNotifier(notify);
planetixService.setNotifier(notify);

// Leer variables de entorno para webhook y server
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook';
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || process.env.RAILWAY_STATIC_URL;

// Comando /start
bot.start((ctx) => {
  userChatId = ctx.chat.id;
  ctx.reply('CryBot listo. Usa /saldo para ver balances o /nfts para listar tus NFTs.');
});

// Comando /ping
bot.command('ping', (ctx) => ctx.reply('pong'));

// Comando /saldo
bot.command('saldo', async (ctx) => {
  try {
    const tonBalance = await tonService.getTonBalance();
    const evmBalance = await planetixService.getEvmBalance();
    const tonCount = await tonService.getInventoryCount();
    const pixCount = await planetixService.getInventoryCount();

    await ctx.reply(
      `Saldo TON: ${tonBalance} TON\n` +
      `Saldo MATIC: ${evmBalance} MATIC\n\n` +
      `NFTs en TON: ${tonCount}\n` +
      `NFTs en PlanetIX: ${pixCount}`
    );
  } catch (err) {
    console.error('Error en comando /saldo:', err.message);
    ctx.reply('Error al obtener saldos o inventario.');
  }
});

// Comando /nfts
bot.command('nfts', async (ctx) => {
  try {
    const nfts = await tonService.getInventory();
    if (!nfts || nfts.length === 0) {
      return ctx.reply('No se encontraron NFTs en tu wallet TON.');
    }

    const maxList = 10;
    let message = `NFTs en tu wallet TON (primeros ${Math.min(maxList, nfts.length)}):\n`;

    nfts.slice(0, maxList).forEach((nft, idx) => {
      const name = nft.metadata?.name || nft.name || nft.address || nft.id;
      message += `${idx + 1}. ${name}\n`;
    });

    if (nfts.length > maxList) {
      message += `... y ${nfts.length - maxList} más.`;
    }

    await ctx.reply(message);
  } catch (err) {
    console.error('Error en comando /nfts:', err.message);
    ctx.reply('No se pudieron obtener tus NFTs.');
  }
});

// Express + Webhook
const app = express();
app.use(express.json());

// Ruta webhook
app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body).catch((err) => console.error(err));
  res.sendStatus(200);
});

// Healthcheck
app.get('/health', (_req, res) => res.status(200).send('OK'));

// Root
app.get('/', (_req, res) => res.status(200).send('CryBot server OK'));

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`Servidor Express escuchando en el puerto ${PORT}`);

  if (BASE_URL) {
    try {
      await bot.telegram.setWebhook(`${BASE_URL}${WEBHOOK_PATH}`);
      console.log('Webhook configurado correctamente');
    } catch (err) {
      console.error('Error al configurar el webhook:', err.message);
    }
  } else {
    console.warn(
      'BASE_URL no definido. El webhook no se configurará automáticamente.'
    );
  }
});

// fix build
