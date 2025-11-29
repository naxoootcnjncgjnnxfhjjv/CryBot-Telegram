const cron = require('node-cron');

// This scheduler module centralises all periodic jobs for CryBot2025.
//
// It is responsible for orchestrating the various background tasks that
// maintain the bot's functionality.  Each job is wrapped in a try/catch
// to avoid unhandled promise rejections and to log any errors without
// stopping the scheduler.  The schedule uses a one‑minute interval to
// ensure timely execution of critical tasks such as scanning wallets,
// claiming airdrops, selling NFTs, transferring funds and performing
// staking or farming actions.  Feel free to adjust the crontab strings
// or add/remove jobs as the project evolves.

// Lazy imports: these modules are optional.  If a module is missing the
// scheduler will log a warning and continue.
let scanWallets;
let claimAirdrops;
let sellNFTs;
let transferFunds;
let stakeAssets;

let checkPlanetIXOffers;

try {
  ({ scanWallets } = require('../wallets/scan'));
} catch (_err) {
  scanWallets = async () => {
    console.warn('[cron] scanWallets module not found; skipping wallet scan');
  };
}

try {
  ({ claimAirdrops } = require('../airdrops/claim'));
} catch (_err) {
  claimAirdrops = async () => {
    console.warn('[cron] claimAirdrops module not found; skipping airdrop claims');
  };
}

try {
  ({ sellNFTs } = require('../nfts/sell'));
} catch (_err) {
  sellNFTs = async () => {
    console.warn('[cron] sellNFTs module not found; skipping NFT sales');
  };
}

try {
  ({ transferFunds } = require('../funds/transfer'));
} catch (_err) {
  transferFunds = async () => {
    console.warn('[cron] transferFunds module not found; skipping auto‑transfer');
  };
}

try {
  ({ stakeAssets } = require('../staking/stake'));
} catch (_err) {
  stakeAssets = async () => {
    console.warn('[cron] stakeAssets module not found; skipping staking/farming');
  };
}

async function runJobs() {
  try {
    await scanWallets();
  } catch (err) {
    console.error('[cron] scanWallets error:', err);
  }
  try {
    await claimAirdrops();
  } catch (err) {
    console.error('[cron] claimAirdrops error:', err);
  }
  try {
    await sellNFTs();
  } catch (err) {
    console.error('[cron] sellNFTs error:', err);
  }
  try {
    await transferFunds();
  } catch (err) {
    console.error('[cron] transferFunds error:', err);
  }
  try {
    await stakeAssets();
  } catch (err) {
    console.error('[cron] stakeAssets error:', err);
  }
      try {
        const planetix = require('../planetix');
        await planetix.checkOffers();
    } catch (err) {
        console.error('[cron] planetix error:', err);
    }

}    


// Schedule all jobs to run every minute.  The '*' in the first field means
// "every minute" within the hour.  Adjust the crontab string if you need a
// different cadence (e.g. '*/5 * * * *' for every five minutes).
cron.schedule('* * * * *', () => {
  console.log('[cron] Running scheduled jobs…');
  runJobs();
});

console.log('[cron] Scheduler initialised. All jobs will run every minute.');
