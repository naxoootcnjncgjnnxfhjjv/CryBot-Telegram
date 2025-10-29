const { Telegraf } = require('telegraf');
const axios = require('axios');
const { ethers } = require('ethers');
const cron = require('node-cron');
const { loadConfig } = require('./config');

// Load configuration from environment and .env file
const config = loadConfig();

// Initialise provider and wallet for EVM network
const provider = new ethers.JsonRpcProvider(config.rpcUrl);
let wallet = null;
if (config.privateKey) {
  try {
    wallet = new ethers.Wallet(config.privateKey, provider);
  } catch (err) {
    console.error('❌ PRIVATE_KEY inválida:', err.message);
  }
}

// Create bot instance
const bot = new Telegraf(config.botToken);

// Helper to check if a chat user is the administrator
const isAdmin = (ctx) => {
  return String(ctx.from?.id) === String(config.adminId);
};

/**
 * Scan an EVM address and return its Ether balance
 * @param {string|null} addr - Address to scan
 * @returns {Promise<{address: string, eth?: number, error?: string}>}
 */
async function scanEvm(addr) {
  if (!addr) return null;
  try {
    const bal = await provider.getBalance(addr);
    return {
      address: addr,
      eth: Number(ethers.formatEther(bal)),
    };
  } catch (err) {
    console.error('scanEvm error:', err.message);
    return { address: addr, error: err.message };
  }
}

/**
 * Scan a TON address and return its balance using the TON API
 * Requires a valid TON API key in config.tonApiKey
 * @param {string|null} addr - TON address to scan
 * @returns {Promise<{address: string, ton?: number, error?: string, note?: string}>}
 */
async function scanTon(addr) {
  if (!addr) return null;
  if (!config.tonApiKey) {
    console.warn('⚠️ TON API key not configured');
    return { address: addr, ton: null, error: 'Missing TON API key' };
  }
  try {
    const url = `https://tonapi.io/v2/wallet/info?account=${encodeURIComponent(addr)}`;
    const headers = {
      'x-api-key': config.tonApiKey,
      Accept: 'application/json',
    };
    const res = await axios.get(url, { headers, timeout: 10000 });
    const data = res.data || {};
    // Many TON APIs return balances in nanoTON (1e9 per TON)
    if (data.balance) {
      const balanceNano = Number(data.balance);
      return { address: addr, ton: balanceNano / 1e9 };
    }
    if (data.account && data.account.balance) {
      const balanceNano = Number(data.account.balance);
      return { address: addr, ton: balanceNano / 1e9 };
    }
    return { address: addr, ton: null, note: 'Balance not found' };
  } catch (err) {
    console.error('scanTon error for', addr, err.message || err);
    return { address: addr, error: err.message || String(err) };
  }
}

/**
 * Claim airdrops for all configured wallets
 * This function is a skeleton; integrate your contract/API logic where indicated.
 * @returns {Promise<{claimed: Array}>}
 */
async function claimAirdropsForAll() {
  const results = [];
  const wallets = [];
  if (Array.isArray(config.wallets?.evm)) {
    config.wallets.evm.forEach((addr) => {
      wallets.push({ address: addr, type: 'evm' });
    });
  }
  if (Array.isArray(config.wallets?.ton)) {
    config.wallets.ton.forEach((addr) => {
      wallets.push({ address: addr, type: 'ton' });
    });
  }
  // Additional networks (e.g., aptos) can be added here
  for (const w of wallets) {
    try {
      if (w.type === 'evm') {
        // TODO: Integrate EVM airdrop claim logic here using ethers.js and appropriate contracts
        results.push({ address: w.address, network: 'evm', claimed: false, note: 'Integrate EVM claim logic' });
      } else if (w.type === 'ton') {
        // TODO: Integrate TON airdrop claim logic here using TON APIs or contracts
        results.push({ address: w.address, network: 'ton', claimed: false, note: 'Integrate TON claim logic' });
      } else {
        results.push({ address: w.address, claimed: false, error: 'Unknown wallet type' });
      }
    } catch (err) {
      results.push({ address: w.address, claimed: false, error: err.message || String(err) });
    }
  }
  return { claimed: results };
}

// ===== Telegram bot commands =====
bot.start((ctx) => ctx.reply('Hola, CryBot activo. Usa /help'));

bot.command('help', (ctx) => {
  ctx.reply([
    '/status — test de vida',
    '/saldo — ver balances EVM / TON',
    '/reclamar — ejecutar airdrops (solo admin)',
    '/enviar <amountETH> <to> — enviar ETH (solo admin)',
  ].join('\n'));
});

bot.command('status', (ctx) => {
  ctx.reply('OK');
});

bot.command('saldo', async (ctx) => {
  // Use the first configured EVM wallet or default wallet
  const evmAddr = config.wallets?.evm?.[0] || config.wallets?.main || config.defaultEth;
  const tonAddr = config.wallets?.ton?.[0] || null;
  const evm = await scanEvm(evmAddr);
  const ton = await scanTon(tonAddr);
  ctx.reply(`Balances:\nEVM: ${JSON.stringify(evm)}\nTON: ${JSON.stringify(ton)}`);
});

bot.command('reclamar', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('❌ No autorizado');
  }
  try {
    const res = await claimAirdropsForAll();
    ctx.reply(`✅ Reclamos: ${JSON.stringify(res)}`);
  } catch (err) {
    console.error('Error en /reclamar:', err.message || err);
    ctx.reply(`❌ Error en reclamar: ${err.message || err}`);
  }
});

bot.command('enviar', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('❌ No autorizado');
  }
  if (!wallet) {
    return ctx.reply('❌ No hay clave privada disponible');
  }
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 3) {
    return ctx.reply('Uso: /enviar <amountETH> <to>');
  }
  const amountStr = parts[1];
  const to = parts[2];
  if (!ethers.isAddress(to)) {
    return ctx.reply('Dirección inválida. Debe ser una dirección EVM válida.');
  }
  const amount = Number(amountStr);
  if (!isFinite(amount) || amount <= 0) {
    return ctx.reply('Cantidad inválida. Debe ser un número positivo.');
  }
  try {
    const value = ethers.parseEther(String(amount));
    const tx = await wallet.sendTransaction({ to, value });
    ctx.reply(`✅ Enviando: ${tx.hash}`);
  } catch (err) {
    console.error('Error en /enviar:', err.message || err);
    ctx.reply(`❌ Error al enviar: ${err.message || err}`);
  }
});

// ===== Scheduled tasks =====
// Automatic scan every 5 minutes
setInterval(async () => {
  try {
    const evmAddr = config.wallets?.evm?.[0] || config.wallets?.main || config.defaultEth;
    const tonAddr = config.wallets?.ton?.[0] || null;
    const evm = await scanEvm(evmAddr);
    const ton = await scanTon(tonAddr);
    if (config.adminId) {
      await bot.telegram.sendMessage(
        config.adminId,
        `Scan automático:\nEVM: ${JSON.stringify(evm)}\nTON: ${JSON.stringify(ton)}`,
      );
    }
  } catch (err) {
    console.error('Error en escaneo periódico:', err.message || err);
  }
}, 5 * 60 * 1000);

// Daily report at 09:00
cron.schedule('0 9 * * *', async () => {
  try {
    const evmAddr = config.wallets?.evm?.[0] || config.wallets?.main || config.defaultEth;
    const tonAddr = config.wallets?.ton?.[0] || null;
    const evm = await scanEvm(evmAddr);
    const ton = await scanTon(tonAddr);
    if (config.adminId) {
      await bot.telegram.sendMessage(
        config.adminId,
        `Reporte diario:\nEVM: ${JSON.stringify(evm)}\nTON: ${JSON.stringify(ton)}`,
      );
    }
  } catch (err) {
    console.error('Error en reporte diario:', err.message || err);
  }
});

// ===== Launch the bot =====
bot.launch()
  .then(() => console.log('✅ Bot lanzado (polling)'))
  .catch((err) => {
    console.error('❌ Error al lanzar bot:', err.message || err);
    process.exit(1);
  });

// Keep the process alive
process.stdin.resume();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
