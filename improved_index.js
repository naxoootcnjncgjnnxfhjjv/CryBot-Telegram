import { Telegraf } from 'telegraf';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
// Eliminamos importación de node‑schedule.
// Para la funcionalidad de harvest periódico emplearemos setInterval.

// Import helpers and services
import { marketplaceOpenSea } from './commands/sell_opensea.js';
import { marketplaceLooksRare } from './commands/sell_looksrare.js';
import { marketplaceBlur } from './commands/sell_blur.js';
import { claimRewards } from './services/airdrop.js';
import { setupTracking } from './services/tracking.js';
import { withTxDelay } from './utils/txQueue.js';
import { loadConfig } from './config.js';

// Cargar configuración de entorno
dotenv.config();
const config = loadConfig();

// Inicializar provider y wallet
const provider = new ethers.JsonRpcProvider(config.rpcUrl);
let wallet;
try {
  wallet = new ethers.Wallet(config.privateKey, provider);
} catch (err) {
  console.error('Error: Clave privada inválida o no proporcionada.');
  process.exit(1);
}

// Inicializar bot de Telegraf
const bot = new Telegraf(config.botToken);

// Middleware de autorización: solo el adminId puede usar el bot
bot.use((ctx, next) => {
  if (ctx.from && ctx.from.id === config.adminId) {
    return next();
  }
  // Ignorar mensajes de otros usuarios
  return;
});

// Comando /help: muestra comandos disponibles
bot.command('help', ctx => {
  ctx.reply([
    ' Comandos disponibles:',
    '/ping - Comprueba si el bot está activo',
    '/balance [address] - Muestra el saldo ETH de una dirección (por defecto la wallet del bot)',
    '/destino - Muestra la dirección destino configurada',
    '/vender <market> <collection> <tokenId> <precio> [moneda=ETH|WETH] [tipo=ERC721|ERC1155] [cantidad] [duracion en días] - Crea una orden de venta',
    '/confirmar <codigo> - Confirma la acción de venta pendiente',
    '/claim <contrato> - Reclama recompensas de un contrato',
    '/claimall [contratos...] - Reclama recompensas de todos los contratos configurados o especificados',
    '/help - Muestra este mensaje de ayuda'
  ].join('\n'));
});

// Comando /ping
bot.command('ping', ctx => {
  ctx.reply(' pong');
});

// Comando /balance [address]
bot.command('balance', async ctx => {
  try {
    const parts = ctx.message.text.trim().split(' ');
    let address = config.walletAddress;
    if (parts.length > 1 && ethers.isAddress(parts[1])) {
      address = parts[1];
    }
    const balance = await provider.getBalance(address);
    const ethBalance = ethers.formatEther(balance);
    ctx.reply(` Saldo de ${address}:\n${ethBalance} ETH`);
  } catch (error) {
    console.error(error);
    ctx.reply('❌ Error obteniendo el balance.');
  }
});

// Comando /destino
bot.command('destino', ctx => {
  if (config.destination) {
    ctx.reply(` Wallet destino configurada: ${config.destination}`);
  } else {
    ctx.reply('⚠️ No hay wallet destino configurada.');
  }
});

// Variables para manejo de confirmación de acciones sensibles
let pendingAction = null;
let pendingCode = null;

// Comando /vender
bot.command('vender', async ctx => {
  const params = ctx.message.text.split(' ').slice(1);
  if (params.length < 5) {
    ctx.reply('❌ Uso: /vender [market] [collection] [tokenId] [precio] [moneda] [tipo] [cantidad] [duración]');
    return;
  }
  const [market, collection, tokenId, price, currency, type, quantity, duration] = params;
  const marketLower = market.toLowerCase();
  if (!['opensea', 'looksrare', 'blur'].includes(marketLower)) {
    ctx.reply('❌ Mercado inválido. Debe ser opensea, looksrare o blur.');
    return;
  }
  if (!ethers.isAddress(collection)) {
    ctx.reply('❌ Dirección de colección inválida.');
    return;
  }
  const currencyUpper = currency.toUpperCase();
  if (!['ETH', 'WETH'].includes(currencyUpper)) {
    ctx.reply('❌ Moneda inválida. Use ETH o WETH.');
    return;
  }
  const typeUpper = type ? type.toUpperCase() : 'ERC721';
  if (!['ERC721', 'ERC1155'].includes(typeUpper)) {
    ctx.reply('❌ Tipo inválido. Use ERC721 o ERC1155.');
    return;
  }
  // Validar precio y parsear
  const priceFloat = parseFloat(price);
  if (isNaN(priceFloat) || priceFloat <= 0) {
    ctx.reply('❌ Precio inválido.');
    return;
  }
  // Validar cantidad (solo aplica a ERC1155)
  const qtyInt = quantity ? parseInt(quantity, 10) : 1;
  if (typeUpper === 'ERC1155' && (isNaN(qtyInt) || qtyInt <= 0)) {
    ctx.reply('❌ Cantidad inválida para ERC1155.');
    return;
  }
  // Validar duración
  const durInt = duration ? parseInt(duration, 10) : 1;
  if (isNaN(durInt) || durInt <= 0) {
    ctx.reply('❌ Duración inválida.');
    return;
  }
  // Generar código de confirmación
  pendingCode = Math.floor(Math.random() * 900000 + 100000);
  pendingAction = {
    market: marketLower,
    collection,
    tokenId,
    price: priceFloat,
    currency: currencyUpper,
    type: typeUpper,
    quantity: qtyInt,
    duration: durInt
  };
  ctx.reply(
    `⚠️ Confirma la venta del NFT \`${collection} #${tokenId}\` en *${marketLower}* por *${priceFloat} ${currencyUpper}*.` +
      `\nResponde con /confirmar ${pendingCode} para confirmar.`,
    { parse_mode: 'Markdown' }
  );
});

// Comando /confirmar
bot.command('confirmar', async ctx => {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) {
    ctx.reply('❌ Debes proporcionar el código de confirmación.');
    return;
  }
  const code = parts[1].trim();
  if (!pendingAction || !pendingCode) {
    ctx.reply('⚠️ No hay ninguna acción pendiente de confirmar.');
    return;
  }
  if (code !== String(pendingCode)) {
    ctx.reply('❌ Código de confirmación incorrecto.');
    return;
  }
  // Código válido: ejecutar la acción
  const action = pendingAction;
  pendingAction = null;
  pendingCode = null;
  ctx.reply(`⏳ Confirmado. Ejecutando listado en ${action.market}...`);
  try {
    let result;
    if (action.market === 'opensea') {
      result = await withTxDelay(() =>
        marketplaceOpenSea(
          wallet,
          action.collection,
          action.tokenId,
          action.price,
          action.currency,
          action.type,
          action.quantity,
          action.duration
        )
      );
    } else if (action.market === 'looksrare') {
      result = await withTxDelay(() =>
        marketplaceLooksRare(
          wallet,
          action.collection,
          action.tokenId,
          action.price,
          action.currency,
          action.type,
          action.quantity,
          action.duration
        )
      );
    } else if (action.market === 'blur') {
      result = await withTxDelay(() =>
        marketplaceBlur(
          wallet,
          action.collection,
          action.tokenId,
          action.price,
          action.currency,
          action.type,
          action.quantity,
          action.duration
        )
      );
    }
    if (result && result.success) {
      ctx.reply(`✅ NFT listado correctamente en ${action.market}.\n${result.message}`);
    } else {
      ctx.reply(
        `⚠️ Se ejecutó la orden en ${action.market}, pero no se pudo confirmar el listado. ${result ? result.message : ''}`
      );
    }
  } catch (error) {
    console.error('Error en /confirmar:', error);
    ctx.reply(`❌ Error al listar NFT: ${error.message || error}`);
  }
});

// Comando /claim
bot.command('claim', async ctx => {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) {
    ctx.reply('❌ Uso: /claim [direccionContrato]');
    return;
  }
  const contractAddr = parts[1];
  if (!ethers.isAddress(contractAddr)) {
    ctx.reply('❌ Dirección de contrato inválida.');
    return;
  }
  ctx.reply(`⏳ Reclamando recompensas en contrato ${contractAddr}...`);
  try {
    const tx = await withTxDelay(() => claimRewards(wallet, contractAddr));
    if (tx) {
      ctx.reply(`✅ Recompensas reclamadas en ${contractAddr}. TX: ${tx.hash}`);
    } else {
      ctx.reply(`⚠️ No hay recompensas pendientes en ${contractAddr} o no se pudo reclamar.`);
    }
  } catch (error) {
    console.error('Error en /claim:', error);
    ctx.reply(`❌ Error al reclamar en ${contractAddr}: ${error.message || error}`);
  }
});

// Comando /claimall
bot.command('claimall', async ctx => {
  // Permitir lista de contratos separados por espacios o comas
  const raw = ctx.message.text.split(' ').slice(1).join(' ');
  const parts = raw.split(/[,\s]+/).filter(Boolean);
  let contracts = config.contractsToClaim || [];
  if (parts.length > 0) {
    contracts = parts.filter(addr => ethers.isAddress(addr));
  }
  if (!contracts || contracts.length === 0) {
    ctx.reply('⚠️ No hay contratos configurados para reclamar.');
    return;
  }
  ctx.reply(`⏳ Reclamando en múltiples contratos (${contracts.length})...`);
  let summary = '';
  for (const addr of contracts) {
    try {
      const tx = await withTxDelay(() => claimRewards(wallet, addr));
      if (tx) {
        summary += `✅ ${addr}: TX ${tx.hash}\n`;
      } else {
        summary += `⚠️ ${addr}: sin recompensas o no aplicable\n`;
      }
    } catch (error) {
      console.error(`Error reclamando en ${addr}:`, error);
      summary += `❌ ${addr}: error (${error.message || error})\n`;
    }
  }
  ctx.reply(` *Resultado de Claim All:*\n${summary}`, { parse_mode: 'Markdown' });
});

// Iniciar monitoreo de eventos si hay dirección de seguimiento
if (config.trackAddress) {
  setupTracking(provider, bot, config.trackAddress, config.adminId);
  console.log(` Tracking habilitado para la dirección: ${config.trackAddress}`);
}

// Programar tarea de harvest periódico
i// Handler para consultas inline
bot.on('inline_query', async ctx => {
  const query = ctx.inlineQuery.query.trim().toLowerCase();
  const results = [
    {
      type: 'article',
      id: 'saldo',
      title: 'Ver saldo total',
      description: 'Muestra el saldo combinado de tus wallets.',
      input_message_content: {
        message_text: '🔍 Consultando saldo total...'
      }
    },
    {
      type: 'article',
      id: 'nfts',
      title: 'Ver NFTs',
      description: 'Lista tus NFTs y su valor estimado.',
      input_message_content: {
        message_text: '🖼 Listando NFTs...'
      }
    },
    {
      type: 'article',
      id: 'airdrops',
      title: 'Buscar Airdrops',
      description: 'CryBot escanea todos tus airdrops.',
      input_message_content: {
        message_text: '🪂 Escaneando airdrops...'
      }
    }
  ];
  await ctx.answerInlineQuery(results, { cache_time: 0 });
});
f (config.harvestInterval > 0) {
  const intervalMin = config.harvestInterval;
  setInterval(async () => {
    if (config.contractsToClaim && config.contractsToClaim.length > 0) {
      console.log('⏲️ Ejecución periódica de harvest para contratos configurados...');
      for (const addr of config.contractsToClaim) {
        try {
          const tx = await withTxDelay(() => claimRewards(wallet, addr));
          if (tx) {
            bot.telegram.sendMessage(
              config.adminId,
              `⏲️ Harvest auto: Recompensas reclamadas en ${addr}. TX: ${tx.hash}`
            );
          }
        } catch (err) {
          console.error(`Error en harvest programado (${addr}):`, err);
        }
      }
    }
  }, intervalMin * 60 * 1000);
}

// Lanzar el bot
bot.launch().then(() => {
  console.log(' Bot de Telegram iniciado correctamente.');
}).catch(err => {
  console.error('Error al iniciar el bot:', err);
});

// Manejar señal de parada
process.once('SIGINT', () => {
  console.log('SIGINT detectado, deteniendo bot.');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('SIGTERM detectado, deteniendo bot.');
  bot.stop('SIGTERM');
});
