import { formatWalletInventory } from '../services/walletInventory.js';
import { scanBalances } from '../services/balanceScanner.js';

export function registerCommands(bot, config) {
  bot.start((ctx) => {
    ctx.reply('CryBot online');
  });

  bot.command('ping', (ctx) => {
    ctx.reply('pong');
  });

  bot.command('status', async (ctx) => {
    await ctx.reply([
      'CryBot Status',
      `Environment: ${config.nodeEnv}`,
      `TON wallets: ${config.wallets.ton.length}`,
      `EVM wallets: ${config.wallets.evm.length}`,
      `APTOS wallets: ${config.wallets.aptos.length}`,
      `Dry Run: ${config.dryRun}`,
      `Write actions: ${config.enableWriteActions}`
    ].join('\n'));
  });

  bot.command('wallets', async (ctx) => {
    const lines = [
      'Configured wallets',
      `TON: ${config.wallets.ton.length}`,
      `EVM: ${config.wallets.evm.length}`,
      `APTOS: ${config.wallets.aptos.length}`
    ];

    await ctx.reply(lines.join('\n'));
  });

  bot.command('inventory', async (ctx) => {
    await ctx.reply(formatWalletInventory(config));
  });

  bot.command('balances', async (ctx) => {
    const balances = await scanBalances(config);
    const lines = ['Balance summary'];

    for (const item of balances) {
      if (item.error) {
        lines.push(`${item.chain}: ${item.address} -> ERROR (${item.error})`);
      } else {
        lines.push(`${item.chain}: ${item.address} -> ${item.balance} ${item.symbol}`);
      }
    }

    await ctx.reply(lines.join('\n'));
  });
}
