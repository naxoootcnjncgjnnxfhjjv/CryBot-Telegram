// index.js (ESM)
// npm i telegraf ethers @opensea/seaport-js
import { Telegraf } from 'telegraf';
import { ethers, isAddress } from 'ethers';
import { listOnOpenSea } from './sell_opensea.js';
import { listOnLooksRare } from './sell_looksrare.js';
import { listOnBlur } from './sell_blur.js';

// ===== ENV obligatorias =====
const BOT_TOKEN   = process.env.BOT_TOKEN;
const OWNER_ID    = process.env.OWNER_ID ? Number(process.env.OWNER_ID) : null;
const ETH_RPC_URL = process.env.ETH_RPC_URL;   // Infura/Alchemy/Propio
const PRIVATE_KEY = process.env.PRIVATE_KEY;   // Wallet que firma

// ===== ENV opcionales =====
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY || '';
const DEFAULT_SAFE = '0x7B9Fc90C99b2ae4711BDEe31049c357999e79B09';
const SAFE_DEST = (process.env.WITHDRAW_TO || DEFAULT_SAFE).toLowerCase();
const BLOCKED_COLLECTIONS = new Set(
  (process.env.BLOCKED_COLLECTIONS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
);

// ===== Validación de arranque =====
if (!BOT_TOKEN)   { console.error('Falta BOT_TOKEN');   process.exit(1); }
if (!ETH_RPC_URL) { console.error('Falta ETH_RPC_URL'); process.exit(1); }
if (!PRIVATE_KEY) { console.error('Falta PRIVATE_KEY'); process.exit(1); }

// ===== Provider/Signer (globales) =====
const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
const signer   = new ethers.Wallet(PRIVATE_KEY, provider);

// ===== Helpers base =====
const onlyOwner   = (ctx) => OWNER_ID ? (ctx.from && ctx.from.id === OWNER_ID) : true;
const assertOwner = (ctx) => { if (!onlyOwner(ctx)) throw new Error('No autorizado'); };
const assertEvm   = (a)   => { if (!isAddress(a)) throw new Error(`Dirección inválida: ${a}`); };
const assertPos   = (v,n='valor') => { if (!(Number(v)>0)) throw new Error(`${n} debe ser > 0`); };

// ===== Balance helpers =====
const WETH_MAINNET = process.env.WETH_ADDRESS || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];
async function getEthBalance(address) {
  const wei = await provider.getBalance(address);
  return Number(ethers.formatEther(wei));
}
async function getErc20Balance(address, token) {
  const c = new ethers.Contract(token, ERC20_ABI, provider);
  const [raw, decimals, symbol] = await Promise.all([
    c.balanceOf(address),
    c.decimals(),
    c.symbol().catch(() => 'ERC20')
  ]);
  const amt = Number(raw) / (10 ** Number(decimals));
  return { amount: amt, symbol };
}

// ===== Estado de pre-órdenes (/vender -> /confirmar) =====
const pending = new Map(); // code -> payload
const genCode = () => Math.random().toString(36).slice(2, 10);

// ===== Bot =====
const bot = new Telegraf(BOT_TOKEN);

bot.command('start', (ctx) => {
  ctx.reply([
    'CryBot listo.',
    'Comandos:',
    '• /ping',
    '• /destino',
    '• /balance [addressOpcional]',
    '• /vender <market> <collection> <tokenId> <precio> [moneda=ETH|WETH] [tipo=erc721|erc1155] [cantidad=1] [duracionh=24]',
    '   Ej: /vender opensea 0xabc... 1234 0.08 WETH erc721 1 24',
    '• /confirmar <codigo>',
    '• /claim <contract>  (intenta claim() y claim(address))'
  ].join('\n'));
});

bot.command('ping', (ctx) => ctx.reply('pong ✅'));

bot.command('destino', (ctx) => {
  try { assertOwner(ctx); ctx.reply(`Destino protegido: ✅\n${SAFE_DEST}`); }
  catch { ctx.reply('Destino protegido: ✅'); }
});

// ------- /balance -------
bot.command('balance', async (ctx) => {
  try {
    const parts = ctx.message.text.trim().split(/\s+/);
    const addr = parts[1] && parts[1].startsWith('0x')
      ? parts[1]
      : await signer.getAddress();

    if (!isAddress(addr)) return ctx.reply('❌ Dirección inválida');

    const [eth, weth] = await Promise.all([
      getEthBalance(addr),
      getErc20Balance(addr, WETH_MAINNET)
        .then(x => x).catch(() => ({ amount: 0, symbol: 'WETH' }))
    ]);

    ctx.reply([
      `👤 Address: ${addr}`,
      `• ETH:  ${eth}`,
      `• ${weth.symbol}: ${weth.amount}`
    ].join('\n'));
  } catch (e) {
    ctx.reply(`❌ ${e.message}`);
  }
});

// ------- /vender -------
bot.command('vender', async (ctx) => {
  try {
    assertOwner(ctx);
    const p = ctx.message.text.trim().split(/\s+/);
    if (p.length < 5) {
      return ctx.reply('Uso: /vender <market> <collection> <tokenId> <precio> [moneda=ETH|WETH] [tipo=erc721|erc1155] [cantidad=1] [duracionh=24]');
    }
    const [, marketRaw, collection, tokenIdStr, priceStr, currencyRaw='ETH', typeRaw='erc721', qtyRaw='1', durRaw='24'] = p;

    const market = (marketRaw||'').toLowerCase(); // opensea|looksrare|blur
    assertEvm(collection);
    if (BLOCKED_COLLECTIONS.has(collection.toLowerCase())) throw new Error('Colección bloqueada por seguridad');

    const tokenId = BigInt(tokenIdStr); assertPos(Number(tokenId), 'tokenId');
    const price = Number(priceStr);     assertPos(price, 'precio');

    const currency = (currencyRaw||'ETH').toUpperCase(); // ETH|WETH
    if (!['ETH','WETH'].includes(currency)) throw new Error('moneda debe ser ETH o WETH');

    const type = (typeRaw||'erc721').toLowerCase(); // erc721|erc1155
    if (!['erc721','erc1155'].includes(type)) throw new Error('tipo debe ser erc721 o erc1155');

    const quantity = Number(qtyRaw||'1'); if (type==='erc1155') assertPos(quantity, 'cantidad');
    const durationHours = Number(durRaw||'24'); assertPos(durationHours, 'duracionh');

    const code = genCode();
    pending.set(code, { market, collection, tokenId: tokenId.toString(), price, currency, type, quantity, durationHours });

    ctx.reply([
      '📝 Pre-orden creada:',
      `• market: ${market}`,
      `• collection: ${collection}`,
      `• tokenId: ${tokenId}`,
      `• tipo: ${type}`,
      `• cantidad: ${quantity}`,
      `• precio: ${price} ${currency}`,
      `• duración: ${durationHours}h`,
      '',
      `Confirma con: /confirmar ${code}`
    ].join('\n'));
  } catch (e) {
    ctx.reply(`❌ ${e.message}`);
  }
});

// ------- /confirmar -------
bot.command('confirmar', async (ctx) => {
  try {
    assertOwner(ctx);
    const parts = ctx.message.text.trim().split(/\s+/);
    if (parts.length < 2) return ctx.reply('Uso: /confirmar <codigo>');
    const code = parts[1];

    const payload = pending.get(code);
    if (!payload) throw new Error('Código no encontrado o expirado');

    const { market, collection, tokenId, price, currency, type, quantity, durationHours } = payload;
    let res;

    if (market === 'opensea') {
      res = await listOnOpenSea({
        rpcUrl: ETH_RPC_URL,
        privateKey: PRIVATE_KEY,
        apiKey: OPENSEA_API_KEY || undefined,
        collection,
        tokenId,
        tokenType: type,      // 'erc721' | 'erc1155'
        quantity,
        currency,             // 'ETH' | 'WETH' (marcado)
        price,
        durationHours
      });
    } else if (market === 'looksrare') {
      res = await listOnLooksRare({ collection, tokenId, tokenType: type, quantity, currency, price, durationHours });
    } else if (market === 'blur') {
      res = await listOnBlur({ collection, tokenId, tokenType: type, quantity, currency, price, durationHours });
    } else {
      throw new Error('market debe ser opensea | looksrare | blur');
    }

    pending.delete(code);
    const url = res?.url || res?.openSeaUrl || '(ver marketplace)';
    ctx.reply([
      '✅ Listing creado',
      `• market: ${market}`,
      `• collection: ${collection}`,
      `• tokenId: ${tokenId}`,
      `• tipo: ${type}`,
      `• cantidad: ${quantity}`,
      `• precio: ${price} ${currency}`,
      `• expira en: ${durationHours}h`,
      '',
      `Link: ${url}`
    ].join('\n'));
  } catch (e) {
    ctx.reply(`❌ ${e.message}`);
  }
});

// ------- /claim  (airdrop genérico) -------
// Intenta: claim()  -> si falla, claim(address) pasando tu address
const ABI_CLAIM_NOARGS = [ 'function claim()' ];
const ABI_CLAIM_ADDRESS = [ 'function claim(address)' ];

bot.command('claim', async (ctx) => {
  try {
    assertOwner(ctx);
    const parts = ctx.message.text.trim().split(/\s+/);
    if (parts.length < 2) return ctx.reply('Uso: /claim <contract>');
    const contractAddr = parts[1];
    assertEvm(contractAddr);

    const user = await signer.getAddress();
    const cNo = new ethers.Contract(contractAddr, ABI_CLAIM_NOARGS, signer);
    const cAd = new ethers.Contract(contractAddr, ABI_CLAIM_ADDRESS, signer);

    ctx.reply('⏳ Intentando claim()…');
    try {
      const tx1 = await cNo.claim();
      await tx1.wait();
      return ctx.reply(`✅ Claim ejecutado (claim())\nTx: ${tx1.hash}`);
    } catch (_) {
      ctx.reply('⚠️ claim() falló, intento claim(address)…');
    }

    const tx2 = await cAd.claim(user);
    await tx2.wait();
    ctx.reply(`✅ Claim ejecutado (claim(address))\nTx: ${tx2.hash}`);
  } catch (e) {
    ctx.reply(`❌ ${e.message}`);
  }
});
// ------- /claim (versión definitiva) -------
// Soporta claim(address) y claim() automáticamente
const ABI_CLAIM_ADDRESS = [ 'function claim(address)' ];
const ABI_CLAIM_NOARGS  = [ 'function claim()' ];

bot.command('claim', async (ctx) => {
  try {
    assertOwner(ctx);
    const parts = ctx.message.text.trim().split(/\s+/);
    if (parts.length < 2) return ctx.reply('Uso: /claim <contrato>');
    const contractAddr = parts[1];
    assertEvm(contractAddr);

    const user = await signer.getAddress();
    const contractAddrLower = contractAddr.toLowerCase();

    ctx.reply(`⏳ Ejecutando claim para:\n${contractAddrLower}\n\nCuenta: ${user}`);

    // Intentar claim(address)
    try {
      const cAddr = new ethers.Contract(contractAddrLower, ABI_CLAIM_ADDRESS, signer);
      const tx1 = await cAddr.claim(user);
      ctx.reply(`⏳ Tx enviada (claim(address)): ${tx1.hash}`);
      const receipt = await tx1.wait();
      return ctx.reply(`✅ Claim(address) completado\nBloque: ${receipt.blockNumber}\nTx: ${tx1.hash}`);
    } catch (err1) {
      ctx.reply(`⚠️ claim(address) falló, intentando claim()...\n(${err1.message.split('\n')[0]})`);
    }

    // Si falla claim(address), intentar claim()
    try {
      const cNoArgs = new ethers.Contract(contractAddrLower, ABI_CLAIM_NOARGS, signer);
      const tx2 = await cNoArgs.claim();
      ctx.reply(`⏳ Tx enviada (claim()): ${tx2.hash}`);
      const receipt2 = await tx2.wait();
      ctx.reply(`✅ Claim() completado\nBloque: ${receipt2.blockNumber}\nTx: ${tx2.hash}`);
    } catch (err2) {
      ctx.reply(`❌ No se pudo ejecutar el claim\n${err2.message.split('\n')[0]}`);
    }

  } catch (e) {
    ctx.reply(`❌ Error en /claim\n${e.message}`);
  }
});
// ===== Errores y arranque =====
bot.catch((err) => console.error('Error en CryBot:', err));

(async () => {
  try { await bot.launch(); console.log('CryBot iniciado ✅'); }
  catch (e) { console.error('No se pudo iniciar CryBot:', e); process.exit(1); }
})();

process.once('SIGINT', () => { console.log('SIGINT — parada'); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { console.log('SIGTERM — parada'); bot.stop('SIGTERM'); });