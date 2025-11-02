const cron = require('node-cron');

/*
 * cron.js
 *
 * This entrypoint schedules recurring maintenance tasks for CryBot.  It
 * executes two primary jobs:
 *   1. scanAndSend – every ten minutes it scans the bot's wallets on
 *      configured EVM chains (e.g. Ethereum, BSC, Polygon) and sends any
 *      surplus funds above a small gas reserve back to the main
 *      treasury wallet.  See scan_and_send.js for details.
 *   2. autoClaimAirdrops – every twelve hours it attempts to claim
 *      pending rewards or airdrops from a list of contracts provided via
 *      the AIRDROP_CONTRACTS environment variable.  This helps ensure
 *      that rewards do not accumulate unclaimed.
 *
 * To run this scheduler alongside the Telegram bot you can either
 * launch it in a separate process (e.g. `npm run cron`) or import
 * the scheduled tasks into your main application.  Railway allows
 * multiple services per project, so you could create a dedicated
 * worker service that simply runs `node cron.js`.
 */

const { scanAndSend } = require('./scan_and_send');
let autoClaimAirdrops;
try {
  ({ autoClaimAirdrops } = require('./auto_claim_airdrops'));
} catch (_err) {
  autoClaimAirdrops = async () => {
    console.warn('[cron] autoClaimAirdrops module not found; skipping airdrop claims');
  };
}

async function runScanAndSend() {
  try {
    await scanAndSend();
  } catch (err) {
    console.error('[cron] scanAndSend error:', err);
  }
}

async function runAutoClaim() {
  try {
    await autoClaimAirdrops();
  } catch (err) {
    console.error('[cron] autoClaimAirdrops error:', err);
  }
}

cron.schedule('*/10 * * * *', () => {
  console.log('[cron] Running periodic scanAndSend');
  runScanAndSend();
});

cron.schedule('0 */12 * * *', () => {
  console.log('[cron] Running periodic autoClaimAirdrops');
  runAutoClaim();
});

console.log('[cron] Scheduler initialised. scanAndSend will run every 10 minutes, autoClaimAirdrops every 12 hours.');
