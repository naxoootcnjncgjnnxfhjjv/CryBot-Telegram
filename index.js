const { Telegraf } = require('telegraf');
const { loadConfig } = require('./config');
const tonService = require('./services/tonService');
const planetixService = require('./services/planetixService');
const yieldFarmingService = require('./services/yieldFarming');


// Cargar configuración desde variables de entorno
const config = loadConfig();

// Inicializar bot de Telegram
const bot = new Telegraf(config.botToken);

// Guardar chatId del usuario para notificaciones posteriores
let userChatId = null;

// Comando /start: inicia el bot y guarda el chatId
bot.start((ctx) => {
  userChatId = ctx.chat.id;
  ctx.reply('¡Hola! CryBot está listo para monitorizar y vender tus NFTs automáticamente. Usa /balance o /ventas para más detalles.');
});

// Comando /help: muestra ayuda
bot.help((ctx) => {
  ctx.reply('Comandos disponibles:\n/start - Inicia el bot\n/help - Muestra esta ayuda\n/balance - Saldo y NFTs en cartera\n/ventas - Muestra ventas recientes');
});

// Comando /balance: muestra saldos y número de NFTs
bot.command('balance', async (ctx) => {
  try {
    const tonBalance = await tonService.getTonBalance();
    const evmBalance = await planetixService.getEvmBalance();
    const tonCount = await tonService.getInventoryCount();
    const pixCount = await planetixService.getInventoryCount();
    ctx.reply(`Saldo TON: ${tonBalance} TON\nSaldo EVM (MATIC): ${evmBalance} MATIC\nNFTs en TON: ${tonCount}\nNFTs PlanetIX: ${pixCount}`);
  } catch (e) {
    ctx.reply('Error al obtener saldo o inventario. Revisa los logs.');
  }
});

// Comando /ventas: muestra ventas recientes
bot.command('ventas', async (ctx) => {
  const sales = [...tonService.getRecentSales(), ...planetixService.getRecentSales()];
  if (sales.length === 0) {
    ctx.reply('No hay ventas recientes.');
    return;
  }
  let msg = 'Ventas recientes:\n';
  for (const sale of sales) {
    msg += `• ${sale.platform.toUpperCase()}: ${sale.asset} vendido por ${sale.price} ${sale.currency}\n`;
  }
  ctx.reply(msg);
// Comando /yield: muestra tasas APY de stablecoins
bot.command('yield', async (ctx) => {
  try {
    const rates = await yieldFarmingService.getAaveRates();
    let message = 'Tasas de rendimiento actuales:\n';
    Object.keys(rates).forEach(asset => {
      message += `${asset}: ${rates[asset]} APY\n`;
    });
    ctx.reply(message);
  } catch (e) {
    ctx.reply('Error al obtener las tasas de rendimiento.');
  }
});

});

// Funcíón de notificación centralizada
async function notify(message) {
  if (!userChatId) return;
  try {
    await bot.telegram.sendMessage(userChatId, message);
  } catch (err) {
    console.error('Error al enviar notificación de Telegram:', err.message);
  }
}

// Configurar funciones de notificación para servicios
tonService.setNotifier(notify);
planetixService.setNotifier(notify);

// Configurar intervalos de chequeo y venta
const tonInterval = parseInt(process.env.GETGEMS_POLL_MINUTES || '10', 10) * 60 * 1000;
setInterval(async () => {
  try {
    await tonService.checkAndSell();
  } catch (err) {
    console.error('Error en checkAndSell TON:', err);
  }
}, tonInterval);

const pixInterval = parseInt(process.env.PLANETIX_POLL_MINUTES || '10', 10) * 60 * 1000;
setInterval(async () => {
  try {
    await planetixService.checkAndSell();
  } catch (err) {
    console.error('Error en checkAndSell PlanetIX:', err);
  }
}, pixInterval);

// Lanzar el bot
bot.launch();

// Detener bot limpiamente en señales del sistema
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
