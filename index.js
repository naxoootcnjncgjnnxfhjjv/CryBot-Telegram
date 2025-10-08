import { Telegraf } from 'telegraf';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { createRequire } from 'module';
import { scheduleJob } from 'node-schedule';  // Para tareas programadas (opcional)

import { marketplaceOpenSea } from './commands/sell_opensea.js';
import { marketplaceLooksRare } from './commands/sell_looksrare.js';
import { marketplaceBlur } from './commands/sell_blur.js';
import { claimRewards, claimAllRewards } from './services/airdrop.js';
import { setupTracking } from './services/tracking.js';
import { withTxDelay } from './utils/txQueue.js';
import { loadConfig } from './config.js';

// Cargar configuración de entorno
dotenv.config();
const config = loadConfig();  // carga todas las variables necesarias

// Inicializar provider y wallet desde config
const provider = new ethers.JsonRpcProvider(config.rpcUrl);
let wallet;
try {
  wallet = new ethers.Wallet(config.privateKey, provider);
} catch (err) {
  console.error("Error: Clave privada inválida o no proporcionada.");
  process.exit(1);
}

// Inicializar bot de Telegraf
const bot = new Telegraf(config.botToken);

// Middleware de autorización: solo permitir comandos del OWNER_ID
bot.use((ctx, next) => {
  if (ctx.from && ctx.from.id === config.ownerId) {
    return next();
  }
  // Ignorar cualquier otro usuario
  return;  // no responde ni sigue a next()
});

// Comando /ping
bot.command('ping', ctx => {
  ctx.reply('🏓 pong');
});

// Comando /balance [address]
bot.command('balance', async ctx => {
  try {
    // Tomar la dirección proporcionada o la por defecto (wallet del bot)
    const parts = ctx.message.text.trim().split(' ');
    let address = config.walletAddress;
    if (parts.length > 1 && ethers.isAddress(parts[1])) {
      address = parts[1];
    }
    const balance = await provider.getBalance(address);
    const ethBalance = ethers.formatEther(balance);
    ctx.reply(`💰 Saldo de ${address}:\n${ethBalance} ETH`);
  } catch (error) {
    console.error(error);
    ctx.reply('❌ Error obteniendo balance.');
  }
});

// Comando /destino
bot.command('destino', ctx => {
  if (config.destination) {
    ctx.reply(`📥 Wallet destino configurada: ${config.destination}`);
  } else {
    ctx.reply('⚠️ No hay wallet destino configurada.');
  }
});

// Variables para manejo de confirmación de acciones sensibles
let pendingAction = null;
let pendingCode = null;

// Comando /vender [market] [collection] [tokenId] [price] [currency] [type] [quantity] [duration]
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
  // Moneda valida: ETH o WETH
  const currencyUpper = currency.toUpperCase();
  if (!['ETH', 'WETH'].includes(currencyUpper)) {
    ctx.reply('❌ Moneda inválida. Use ETH o WETH.');
    return;
  }
  // Tipo: ERC721 o ERC1155
  const typeUpper = type ? type.toUpperCase() : 'ERC721';
  if (!['ERC721', 'ERC1155'].includes(typeUpper)) {
    ctx.reply('❌ Tipo inválido. Use ERC721 o ERC1155.');
    return;
  }
  const sellQuantity = quantity ? parseInt(quantity) : 1;
  const durationDays = duration ? parseInt(duration) : 1;  // por defecto 1 día
  
  // Generar código de confirmación
  pendingCode = Math.floor(Math.random() * 900000 + 100000);  // código de 6 dígitos
  pendingAction = {
    market: marketLower,
    collection,
    tokenId,
    price,
    currency: currencyUpper,
    type: typeUpper,
    quantity: sellQuantity,
    duration: durationDays
  };
  ctx.reply(`⚠️ Confirma la venta del NFT \`${collection} #${tokenId}\` en *${marketLower}* por *${price} ${currencyUpper}*.\nResponde con /confirmar ${pendingCode} para confirmar.`, { parse_mode: 'Markdown' });
});

// Comando /confirmar [codigo]
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
  // Código válido: ejecutar la acción pendiente
  const action = pendingAction;
  pendingAction = null;
  pendingCode = null;
  ctx.reply(`⏳ Confirmado. Ejecutando listado en ${action.market}...`);
  try {
    let result;
    if (action.market === 'opensea') {
      result = await marketplaceOpenSea(wallet, action.collection, action.tokenId, action.price, action.currency, action.type, action.quantity, action.duration);
    } else if (action.market === 'looksrare') {
      result = await marketplaceLooksRare(wallet, action.collection, action.tokenId, action.price, action.currency, action.type, action.quantity, action.duration);
    } else if (action.market === 'blur') {
      result = await marketplaceBlur(wallet, action.collection, action.tokenId, action.price, action.currency, action.type, action.quantity, action.duration);
    }
    if (result && result.success) {
      ctx.reply(`✅ NFT listado correctamente en ${action.market}.\n${result.message}`);
    } else {
      ctx.reply(`⚠️ Se ejecutó la orden en ${action.market}, pero no se pudo confirmar el listado. ${result ? result.message : ''}`);
    }
  } catch (error) {
    console.error('Error en /confirmar:', error);
    ctx.reply(`❌ Error al listar NFT: ${error.message || error}`);
  }
});

// Comando /claim [contract]
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
    const tx = await claimRewards(wallet, contractAddr);
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

// Comando /claimall [optional list]
bot.command('claimall', async ctx => {
  // Permitir lista de contratos en el mensaje
  const parts = ctx.message.text.split(' ').slice(1);
  let contracts = config.contractsToClaim;
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
      const tx = await claimRewards(wallet, addr);
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
  ctx.reply(`🪂 *Resultado de Claim All:*\n${summary}`, { parse_mode: 'Markdown' });
});

// Iniciar monitoreo de eventos (tracking de wallet Bitget u otra)
if (config.trackAddress) {
  setupTracking(provider, bot, config.trackAddress, config.ownerId);
  console.log(`🔍 Tracking habilitado para la dirección: ${config.trackAddress}`);
}

// Programar tarea de harvest periódico si está configurado intervalo
if (config.harvestInterval > 0) {
  const intervalMin = config.harvestInterval;
  // Usamos node-schedule para ejecutar cada X minutos
  scheduleJob(`*/${intervalMin} * * * *`, async () => {
    if (config.contractsToClaim && config.contractsToClaim.length > 0) {
      console.log('⏲️ Ejecución periódica de harvest para contratos configurados...');
      for (const addr of config.contractsToClaim) {
        try {
          const tx = await claimRewards(wallet, addr);
          if (tx) {
            // Notificar via Telegram al owner
            bot.telegram.sendMessage(config.ownerId, `⏲️ Harvest auto: Recompensas reclamadas en ${addr}. TX: ${tx.hash}`);
          }
        } catch (err) {
          console.error(`Error en harvest programado (${addr}):`, err);
        }
      }
    }
  });
}

// Lanzar el bot
bot.launch().then(() => {
  console.log('🤖 Bot de Telegram iniciado correctamente.');
}).catch(err => {
  console.error('Error al iniciar el bot:', err);
});

// Manejar gracefully el stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));