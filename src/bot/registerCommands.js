import { scanBalances } from '../services/balanceScanner.js';

function shortAddress(address = '') {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function formatBalances(balances) {
  if (!balances.length) return 'No hay wallets configuradas.';

  const grouped = new Map();

  for (const item of balances) {
    if (!grouped.has(item.chain)) grouped.set(item.chain, []);
    grouped.get(item.chain).push(item);
  }

  const lines = [];

  for (const [chain, items] of grouped.entries()) {
    lines.push(`${chain}`);

    for (const item of items) {
      if (item.error) {
        lines.push(`- ${shortAddress(item.address)}: error`);
      } else {
        lines.push(`- ${shortAddress(item.address)}: ${item.balance} ${item.symbol}`);
      }
    }
  }

  return lines.join('\n');
}

export function registerCommands(bot, config) {
  bot.start((ctx) => {
    ctx.reply('CryBot operativo. Usa /status o /balances.');
  });

  bot.command('ping', (ctx) => {
    ctx.reply('ok');
  });

  bot.command('status', async (ctx) => {
    await ctx.reply([
      'CryBot OK',
      `TON: ${config.wallets.ton.length}`,
      `EVM: ${config.wallets.evm.length}`,
      `APTOS: ${config.wallets.aptos.length}`,
      `DryRun: ${config.dryRun}`
    ].join('\n'));
  });

  bot.command('wallets', async (ctx) => {
    await ctx.reply(`TON ${config.wallets.ton.length} | EVM ${config.wallets.evm.length} | APTOS ${config.wallets.aptos.length}`);
  });

  bot.command('balances', async (ctx) => {
    await ctx.reply('Escaneando balances...');

    const balances = await scanBalances(config);
    await ctx.reply(formatBalances(balances));
  });
}
