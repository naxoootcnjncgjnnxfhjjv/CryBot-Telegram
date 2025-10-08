// index.js
// npm i telegraf
const { Telegraf } = require('telegraf');

// --- Env ---
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('Error: falta BOT_TOKEN');
  process.exit(1);
}

const OWNER_ID = process.env.OWNER_ID ? Number(process.env.OWNER_ID) : null;
const DEFAULT_SAFE = '0x7B9Fc90C99b2ae4711BDEe31049c357999e79B09';
const SAFE_DEST = (process.env.WITHDRAW_TO || DEFAULT_SAFE).toLowerCase();

const BLOCKED = new Set(
  (process.env.BLOCKED_TO || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
);

// --- Helpers ---
const isEvmAddress = (s) => /^0x[0-9a-fA-F]{40}$/.test(s);
function assertSafeDest(addr) {
  if (!addr) throw new Error('WITHDRAW_TO vacío o no configurado');
  if (!isEvmAddress(addr)) throw new Error(`Dirección inválida: ${addr}`);
  if (BLOCKED.has(addr)) throw new Error('Destino bloqueado por seguridad');
  return addr;
}
function pickWithdrawAddress() {
  return assertSafeDest(SAFE_DEST);
}
function onlyOwner(ctx) {
  if (!OWNER_ID) return true;
  return ctx.from && ctx.from.id === OWNER_ID;
}

// --- Bot ---
const bot = new Telegraf(BOT_TOKEN);

// /start
bot.command('start', (ctx) => {
  ctx.reply('Soy CryBot.\n/destino para ver el destino protegido.\n/ping para estado.');
});

// /ping
bot.command('ping', (ctx) => ctx.reply('pong ✅'));

// /destino (único, sin duplicados)
bot.command('destino', (ctx) => {
  try {
    const addr = pickWithdrawAddress();
    const msg = `Protección de destino: ✅\nDestino actual:\n${addr}`;
    if (onlyOwner(ctx)) {
      ctx.reply(msg);
    } else {
      ctx.reply('Protección de destino: ✅');
    }
  } catch (err) {
    ctx.reply(`❌ ${err.message}`);
  }
});

// Errores
bot.catch((err) => {
  console.error('Error en CryBot:', err);
});

// Lanzar (polling)
(async () => {
  try {
    await bot.launch();
    console.log('CryBot iniciado ✅');
    console.log('Destino:', pickWithdrawAddress());
  } catch (e) {
    console.error('No se pudo iniciar CryBot:', e);
    process.exit(1);
  }
})();

// Parada limpia
process.once('SIGINT', () => { console.log('SIGINT — deteniendo CryBot...'); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { console.log('SIGTERM — deteniendo CryBot...'); bot.stop('SIGTERM'); });