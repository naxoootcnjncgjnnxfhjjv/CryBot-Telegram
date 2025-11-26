import { Telegraf, Context } from 'telegraf';
import { startOffersAcceptor } from '../jobs/offers-acceptor';
import { buildOfferFilterFromEnv } from '../ton/offers';

// Keep a reference to the running offers acceptor so we can stop/restart it
let stopAcceptor: (() => void) | null = null;

/**
 * Produces a human readable summary of the current auto‑accept settings.
 */
function getStatus(): string {
  const enabled = process.env.AUTO_ACCEPT_ENABLED === '1' || process.env.AUTO_ACCEPT_ENABLED === 'true';
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  const minTon = process.env.AUTO_ACCEPT_MIN_TON || '0';
  const whitelist = process.env.AUTO_ACCEPT_WHITELIST || '(not set)';
  const blacklist = process.env.AUTO_ACCEPT_BLACKLIST || '(not set)';
  const mode = process.env.TONAPI_KEY ? 'streaming' : 'polling';
  return (
    `Auto‑accept is ${enabled ? 'enabled' : 'disabled'}.\n` +
    `Dry‑run: ${dryRun}.\n` +
    `Minimum price: ${minTon} TON.\n` +
    `Whitelist: ${whitelist}.\n` +
    `Blacklist: ${blacklist}.\n` +
    `Mode: ${mode}.\n`
  );
}

/**
 * Restarts the offers acceptor job if it is currently running.  If the job
 * is disabled it will not start.  This is used after changing settings.
 */
function restartJob() {
  if (stopAcceptor) {
    stopAcceptor();
    stopAcceptor = null;
  }
  const enabled = process.env.AUTO_ACCEPT_ENABLED === '1' || process.env.AUTO_ACCEPT_ENABLED === 'true';
  if (enabled) {
    stopAcceptor = startOffersAcceptor();
  }
}

/**
 * Registers Telegram commands that control the auto‑accept functionality.
 *
 * Commands supported:
 *   /autoaccept on  – enable auto‑accept
 *   /autoaccept off – disable auto‑accept
 *   /autoaccept dryrun on|off
 *   /autoaccept min <ton> – set minimum price in TON
 *   /autoaccept status – show current settings
 */
export function registerAutoAcceptCommands(bot: Telegraf<Context>) {
  bot.command('autoaccept', async (ctx) => {
    const text = ctx.message.text.trim();
    const parts = text.split(/\s+/).slice(1);
    const subcmd = parts[0]?.toLowerCase();
    try {
      switch (subcmd) {
        case 'on': {
          process.env.AUTO_ACCEPT_ENABLED = '1';
          restartJob();
          await ctx.reply('Auto‑accept enabled.');
          break;
        }
        case 'off': {
          process.env.AUTO_ACCEPT_ENABLED = '0';
          restartJob();
          await ctx.reply('Auto‑accept disabled.');
          break;
        }
        case 'dryrun': {
          const val = parts[1]?.toLowerCase();
          if (val === 'on' || val === '1' || val === 'true') {
            process.env.DRY_RUN = '1';
          } else if (val === 'off' || val === '0' || val === 'false') {
            process.env.DRY_RUN = '0';
          } else {
            await ctx.reply('Usage: /autoaccept dryrun on|off');
            return;
          }
          restartJob();
          await ctx.reply(`Dry‑run set to ${process.env.DRY_RUN === '1' ? 'on' : 'off'}.`);
          break;
        }
        case 'min': {
          const value = parseFloat(parts[1]);
          if (isNaN(value) || value < 0) {
            await ctx.reply('Usage: /autoaccept min <positive number>');
            return;
          }
          process.env.AUTO_ACCEPT_MIN_TON = String(value);
          restartJob();
          await ctx.reply(`Minimum price set to ${value} TON.`);
          break;
        }
        case 'status': {
          await ctx.reply(getStatus());
          break;
        }
        default: {
          await ctx.reply(
            'Unknown command. Usage:\n' +
              '/autoaccept on|off\n' +
              '/autoaccept dryrun on|off\n' +
              '/autoaccept min <TON>\n' +
              '/autoaccept status',
          );
        }
      }
    } catch (err) {
      console.error('Error handling autoaccept command', err);
      await ctx.reply(`Error: ${String(err)}`);
    }
  });
}