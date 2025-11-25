/*
 * CryBot v0.9
 *
 * This file contains the entry point for the Telegram bot. It wires up
 * the Telegram commands and background tasks that scan your wallets,
 * trade NFTs and automatically farm opportunities across supported
 * networks. The implementation is intentionally modular so you can
 * extend or replace individual modules for TON, EVM, PlanetIX or
 * GetGems without touching the core logic.
 */

const { Telegraf } = require('telegraf');
const config = require('./config');
const ton = require('./modules/ton');
const evm = require('./modules/evm');
const planetIX = require('./modules/planetIX');
const getGems = require('./modules/getGems');

/**
 * Initialise the Telegram bot using the token from the config. The token
 * must be provided via the BOT_TOKEN environment variable or defined in
 * config.js. Without a valid token the bot will not start.
 */
function initBot() {
  if (!config.BOT_TOKEN) {
    console.error('Missing BOT_TOKEN in config. Set BOT_TOKEN in your environment or config.js');
    process.exit(1);
  }
  const bot = new Telegraf(config.BOT_TOKEN);

  // Helper to catch and log errors from async functions.
  function wrap(fn) {
    return async (...args) => {
      try {
        await fn(...args);
      } catch (err) {
        console.error(err);
        if (args[1] && typeof args[1].reply === 'function') {
          await args[1].reply('Ha ocurrido un error interno. Inténtalo más tarde.');
        }
      }
    };
  }

  // /start command shows a welcome message.
  bot.start(ctx => {
    ctx.reply('¡Bienvenido a CryBot! Usa /saldo para ver tu saldo, /tokens para listar tus tokens, /reclamar para reclamar recompensas y /enviar para enviar tokens.');
  });

  // /saldo muestra el balance de todas las wallets configuradas.
  bot.command('saldo', wrap(async ctx => {
    const tonBalances = await ton.getBalances(config.TON_WALLETS);
    const evmBalances = await evm.getBalances(config.EVM_WALLETS);
    let response = '';
    if (tonBalances.length) {
      response += '*TON*\n';
      tonBalances.forEach(item => {
        response += `• ${item.address}: ${item.balance} TON\n`;
      });
    }
    if (evmBalances.length) {
      response += '\n*EVM*\n';
      evmBalances.forEach(item => {
        response += `• ${item.address}: ${item.balance} ETH\n`;
      });
    }
    if (!response) response = 'No se han configurado wallets.';
    ctx.replyWithMarkdownV2(response);
  }));

  // /tokens lista tokens de cada wallet (sólo EVM por defecto).
  bot.command('tokens', wrap(async ctx => {
    const tokens = await evm.getTokenBalances(config.EVM_WALLETS);
    let response = '';
    tokens.forEach(({ address, tokenBalances }) => {
      response += `*${address}*\n`;
      tokenBalances.forEach(tb => {
        response += `• ${tb.symbol}: ${tb.balance}\n`;
      });
      response += '\n';
    });
    if (!response) response = 'No se han encontrado tokens.';
    ctx.replyWithMarkdownV2(response);
  }));

  // /reclamar lanza reclamos automáticos. Actualmente stub.
  bot.command('reclamar', wrap(async ctx => {
    await planetIX.claimAll();
    await getGems.claimAll();
    ctx.reply('Recompensas reclamadas (si había disponibles).');
  }));

  // /enviar permite enviar tokens. Este es un ejemplo simple que pide
  // parámetros y delega a evm.sendToken. En producción valida entradas
  // y confirma con el usuario antes de enviar.
  bot.command('enviar', wrap(async ctx => {
    const parts = ctx.message.text.split(' ');
    // Esperamos /enviar <address> <amount> <symbol>
    if (parts.length < 4) {
      ctx.reply('Uso: /enviar <address> <amount> <symbol>');
      return;
    }
    const [, to, amount, symbol] = parts;
    const tx = await evm.sendToken(config.EVM_WALLETS[0], to, amount, symbol);
    ctx.reply(`Transacción enviada: ${tx}`);
  }));

  return bot;
}

/**
 * Arranca los procesos periódicos de escaneo y venta automática. Estas
 * funciones se ejecutan en segundo plano para no bloquear el bot de
 * Telegram. Puedes ajustar los intervalos en cada módulo.
 */
function startBackgroundTasks() {
  // Escaneo de wallets cada 5 minutos.
  setInterval(async () => {
    await ton.scanAndSell(config.TON_WALLETS);
    await evm.scanAndSell(config.EVM_WALLETS);
    await planetIX.scanAndSell();
    await getGems.scanAndSell();
  }, 5 * 60 * 1000);
}

// Entrypoint
async function main() {
  const bot = initBot();
  startBackgroundTasks();
  await bot.launch();
  console.log('CryBot iniciado y ejecutándose…');
  // Habilita graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch(err => {
  console.error(err);
});
