import { scanBalances } from '../services/balanceScanner.js';

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
    const lines = [];

    for (const item of balances) {
      if (item.error) {
        lines.push(`${item.chain}: error`);
      } else {
        lines.push(`${item.chain}: ${item.balance} ${item.symbol}`);
      }
    }

    await ctx.reply(lines.length ? lines.join('\n') : 'No hay wallets configuradas.');
  });
}
