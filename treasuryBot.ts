/*
 * Treasury NFT Bot
 *
 * This module implements a simple treasury management and NFT listing bot in
 * TypeScript.  It follows the blueprint described in the previous design:
 * maintaining target allocations across stablecoins, native tokens and beta
 * assets, automatically rebalancing when allocations drift too far, and
 * posting NFTs for sale at a price relative to the current collection floor.
 *
 * The bot is intentionally designed to be modular and testable.  All calls
 * that touch a blockchain, a marketplace or an external price oracle are
 * encapsulated behind interfaces.  This means you can provide real
 * implementations when deploying in production, or mock implementations for
 * testing.  The core logic – calculating when to rebalance, how much to
 * swap, and how to price NFTs – lives in pure functions.
 *
 * Usage:
 *   1. Install dependencies (see the README at the bottom).
 *   2. Provide concrete implementations of the required interfaces (e.g.
 *      BalanceProvider, Swapper, PriceOracle, NFTMarketplace).
 *   3. Instantiate TreasuryBot with your configuration and implementations.
 *   4. Call start() to schedule periodic rebalances and listings.
 *
 * Note: because this file is meant to be illustrative and does not contain
 * actual Web3 or marketplace code, you must implement those parts yourself.
 */

import { BigNumber, ethers } from 'ethers';
import cron from 'node-cron';

/**
 * Targets for treasury allocation.  The bot will attempt to keep the
 * percentage of funds in each bucket (stable, native, beta) within a small
 * deviation of these values.
 */
export interface TreasuryTargets {
  stable: number; // e.g. 0.60 for 60%
  native: number; // e.g. 0.30 for 30%
  beta: number;   // e.g. 0.10 for 10%
}

/**
 * Minimum gas reserves for each supported network.  When the bot sees that
 * the balance of the native gas token falls below this threshold, it will
 * top up from the treasury if possible.
 */
export interface GasMinimums {
  [network: string]: BigNumber;
}

/**
 * Rebalance configuration.  Controls when and how the bot rebalances its
 * allocations.
 */
export interface RebalanceConfig {
  /**
   * How often to check balances and perform a rebalance, in hours.
   */
  intervalHours: number;
  /**
   * Permitted deviation from the target allocation before triggering a
   * rebalance (e.g. 0.05 means ±5%).
   */
  deviationPct: number;
  /**
   * Maximum portion of the total treasury that can be traded in a single
   * rebalance operation.
   */
  maxTradePctTreasury: number;
  /**
   * Maximum acceptable slippage when swapping assets.  Trades that would
   * incur higher slippage will be aborted.
   */
  slippageMaxPct: number;
  /**
   * Percentage price move considered a "shock".  If the native token
   * appreciates or depreciates more than this threshold over 24h, the bot
   * will rebalance to lock in gains or replenish native reserves.
   */
  priceShockThresholdPct: number;
}

/**
 * Pricing configuration for NFTs.  Controls how the bot lists NFTs relative
 * to the current floor price and whether it accepts offers.
 */
export interface PricingConfig {
  /**
   * Percentage below the collection floor at which to list NFTs.  For
   * example, 2 means list at 2% below floor.
   */
  floorFollowDeltaPct: number;
  /**
   * Multiplier on the floor price for offers that are automatically
   * accepted.  For example, 0.95 means accept offers equal to or above
   * 95% of the floor.
   */
  acceptOfferFloorMultiplier: number;
  /**
   * Number of days after which a stale listing will be discounted further.
   */
  staleDaysBeforeDiscount: number;
}

/**
 * Safety configuration.  These settings help the bot protect itself against
 * unexpected conditions such as repeated transaction failures or gas spikes.
 */
export interface SafetyConfig {
  /**
   * Maximum number of consecutive failed transactions before pausing
   * operations.  This can help avoid repeatedly spending gas on failing
   * calls when a network is congested or down.
   */
  maxConsecutiveFailures: number;
  /**
   * If gas price surges by this factor (e.g. 2 means 200%), the bot
   * temporarily halts listing and rebalancing until prices normalize.
   */
  pauseOnGasSpikePct: number;
}

/**
 * Consolidated configuration type for the bot.
 */
export interface BotConfig {
  treasuryTargets: TreasuryTargets;
  gasMinimums: GasMinimums;
  rebalance: RebalanceConfig;
  pricing: PricingConfig;
  safety: SafetyConfig;
}

/**
 * Summary of the current treasury balances.  The bot uses this to decide
 * whether to rebalance.
 */
export interface TreasuryState {
  stable: BigNumber;
  native: BigNumber;
  beta: BigNumber;
}

/**
 * Interface for retrieving balances on the supported networks.  This can
 * connect to JSON-RPC providers or any other service that returns
 * balances for the bot's wallets.
 */
export interface BalanceProvider {
  /**
   * Returns the current treasury balances in stablecoins, native tokens and
   * beta assets.  The units should be normalized to a single stable unit
   * (e.g. USD) for comparability.  This function should also include gas
   * token balances for each network so the bot can check gas minimums.
   */
  getTreasuryState(): Promise<TreasuryState>;
  /**
   * Returns the current gas token balances per network.  Used to top up
   * networks when gas reserves are low.
   */
  getGasBalances(): Promise<{ [network: string]: BigNumber }>;
}

/**
 * Interface for executing swaps between assets.  You can implement this
 * using a DEX aggregator like 1inch or 0x.  The bot will call swap() with
 * the source and destination assets and the amount to trade.  Implementers
 * should handle slippage checks and return the amount received.
 */
export interface Swapper {
  /**
   * Swaps amountIn of the source asset into the destination asset.  The
   * slippageTolerance parameter expresses the maximum slippage the bot is
   * willing to accept.  Throws if the trade would exceed slippage.
   */
  swap(
    from: 'stable' | 'native' | 'beta',
    to: 'stable' | 'native' | 'beta',
    amountIn: BigNumber,
    slippageTolerance: number
  ): Promise<BigNumber>;
}

/**
 * Interface for obtaining price information.  This can be implemented
 * through a price oracle such as Chainlink or by querying an exchange API.
 */
export interface PriceOracle {
  /**
   * Returns the spot price of the native token in stable units (e.g. USD).
   */
  getNativePrice(): Promise<number>;
  /**
   * Returns the 24h price change of the native token as a fraction (e.g.
   * 0.05 for +5%).  Used to detect price shocks.
   */
  getNativePriceChange24h(): Promise<number>;
}

/**
 * Interface for interacting with an NFT marketplace.  Provides methods
 * for listing NFTs, accepting offers and fetching floor prices.  The
 * generic type NFT refers to whatever identifier your NFTs use.
 */
export interface NFTMarketplace<NFT> {
  /**
   * Fetches the current floor price for the collection.  Should return
   * prices in the native token units.
   */
  getCollectionFloor(): Promise<BigNumber>;
  /**
   * Lists an NFT for sale at the given price (in native token units).
   */
  listForSale(token: NFT, price: BigNumber): Promise<void>;
  /**
   * Accepts an offer on the given NFT if the offer meets the configured
   * minimum.  Returns true if an offer was accepted.
   */
  acceptBestOffer(token: NFT, minAcceptablePrice: BigNumber): Promise<boolean>;
  /**
   * Returns a list of NFTs currently held by the bot.  These will be
   * evaluated for listing.
   */
  getInventory(): Promise<NFT[]>;
  /**
   * Returns the timestamp (in milliseconds) when an NFT was last listed.
   * This is used to determine if a listing is stale and should be
   * discounted.
   */
  getLastListedAt(token: NFT): Promise<number | undefined>;
}

/**
 * Primary class that implements the treasury management and NFT listing
 * logic.  It depends on several abstractions (BalanceProvider, Swapper,
 * PriceOracle, NFTMarketplace) that must be provided by the caller.
 */
export class TreasuryBot<NFT> {
  private readonly config: BotConfig;
  private readonly balanceProvider: BalanceProvider;
  private readonly swapper: Swapper;
  private readonly oracle: PriceOracle;
  private readonly marketplace: NFTMarketplace<NFT>;
  private consecutiveFailures: number = 0;
  private paused: boolean = false;

  constructor(
    config: BotConfig,
    balanceProvider: BalanceProvider,
    swapper: Swapper,
    oracle: PriceOracle,
    marketplace: NFTMarketplace<NFT>
  ) {
    this.config = config;
    this.balanceProvider = balanceProvider;
    this.swapper = swapper;
    this.oracle = oracle;
    this.marketplace = marketplace;
  }

  /**
   * Starts the periodic tasks for the treasury bot.  This schedules a
   * rebalance every intervalHours and also checks for NFT listing
   * opportunities.
   */
  public start(): void {
    // Immediately perform a check then schedule recurrent tasks.
    this.runTasks().catch((err) => {
      console.error('Initial run failed:', err);
    });
    const interval = this.config.rebalance.intervalHours;
    cron.schedule(`0 */${interval} * * *`, async () => {
      await this.runTasks();
    });
  }

  /**
   * Executes both treasury rebalancing and NFT listing in one call.  It
   * catches and records failures to enable the pause logic.
   */
  private async runTasks(): Promise<void> {
    if (this.paused) {
      console.warn('Bot is paused due to safety conditions.  Skipping run.');
      return;
    }
    try {
      await this.checkGasBalances();
      await this.rebalanceTreasury();
      await this.listNFTs();
      // Reset failures if all operations succeed.
      this.consecutiveFailures = 0;
    } catch (err) {
      this.consecutiveFailures += 1;
      console.error('Error during runTasks:', err);
      if (this.consecutiveFailures >= this.config.safety.maxConsecutiveFailures) {
        this.paused = true;
        console.error(
          `Paused bot after ${this.consecutiveFailures} consecutive failures.`
        );
      }
    }
  }

  /**
   * Checks the current gas balances and tops up networks that are below
   * their minimum reserve.  If a top up is needed and the treasury has
   * sufficient funds, it will swap stable assets for the native token of
   * that network.
   */
  private async checkGasBalances(): Promise<void> {
    const gasBalances = await this.balanceProvider.getGasBalances();
    for (const network of Object.keys(this.config.gasMinimums)) {
      const min = this.config.gasMinimums[network];
      const current = gasBalances[network] || BigNumber.from(0);
      if (current.lt(min)) {
        const deficit = min.sub(current);
        console.log(
          `Gas balance on ${network} below minimum.  Topping up ${ethers.utils.formatUnits(
            deficit
          )}.`
        );
        // Swap from stable to native on that network.
        await this.swapper.swap(
          'stable',
          'native',
          deficit,
          this.config.rebalance.slippageMaxPct
        );
      }
    }
  }

  /**
   * Determines whether the treasury allocations deviate enough from the
   * targets to warrant a rebalance.  If so, performs trades to bring
   * allocations back towards the target proportions.  Also responds to
   * price shocks in the native token.
   */
  private async rebalanceTreasury(): Promise<void> {
    const state = await this.balanceProvider.getTreasuryState();
    const total = state.stable.add(state.native).add(state.beta);
    if (total.isZero()) {
      console.warn('Treasury total is zero; nothing to rebalance.');
      return;
    }
    // Compute current allocations as fractions of the total.
    const allocStable = state.stable.mul(10000).div(total).toNumber() / 10000;
    const allocNative = state.native.mul(10000).div(total).toNumber() / 10000;
    const allocBeta = state.beta.mul(10000).div(total).toNumber() / 10000;
    const targets = this.config.treasuryTargets;
    const deviation = this.config.rebalance.deviationPct;
    // Determine trades needed.  We'll compute the delta for each bucket.
    const desiredStable = targets.stable * total.toNumber();
    const desiredNative = targets.native * total.toNumber();
    const desiredBeta = targets.beta * total.toNumber();
    const deltas: { [k: string]: number } = {
      stable: desiredStable - state.stable.toNumber(),
      native: desiredNative - state.native.toNumber(),
      beta: desiredBeta - state.beta.toNumber(),
    };
    // Determine if any allocation deviates beyond the threshold.
    const devStable = Math.abs(allocStable - targets.stable);
    const devNative = Math.abs(allocNative - targets.native);
    const devBeta = Math.abs(allocBeta - targets.beta);
    const needRebalance =
      devStable > deviation || devNative > deviation || devBeta > deviation;
    // Also check for price shocks.
    const priceChange = await this.oracle.getNativePriceChange24h();
    const shock = Math.abs(priceChange) > this.config.rebalance.priceShockThresholdPct;
    if (!needRebalance && !shock) {
      console.log('No rebalance needed.');
      return;
    }
    if (shock) {
      console.log(
        `Price shock detected (change: ${(priceChange * 100).toFixed(2)}%).  Triggering rebalance.`
      );
    }
    console.log(
      `Rebalancing treasury: stable=${allocStable.toFixed(
        2
      )}, native=${allocNative.toFixed(2)}, beta=${allocBeta.toFixed(2)}`
    );
    // Build a list of trades.  We'll move amounts between buckets based on
    // whether they have surplus or deficit.  Convert numbers to BigNumber.
    const trades: { from: keyof TreasuryState; to: keyof TreasuryState; amount: BigNumber }[] = [];
    // We'll drain surplus buckets and fill deficit buckets.  Do this in a
    // simplistic single-pass manner; more complex strategies could be used.
    const buckets: (keyof TreasuryState)[] = ['stable', 'native', 'beta'];
    // Convert deltas to BigNumber for calculations; positive means need to
    // add, negative means we have a surplus.
    const deltaBN: { [k in keyof TreasuryState]: BigNumber } = {
      stable: BigNumber.from(Math.floor(deltas['stable'])),
      native: BigNumber.from(Math.floor(deltas['native'])),
      beta: BigNumber.from(Math.floor(deltas['beta'])),
    };
    // Determine total available to trade (bounded by maxTradePctTreasury).
    const maxTrade = total
      .mul(Math.floor(this.config.rebalance.maxTradePctTreasury * 10000))
      .div(10000);
    let traded = BigNumber.from(0);
    // Repeat until we've addressed all deficits or hit the limit.
    for (const from of buckets) {
      if (deltaBN[from].isNegative()) {
        // This bucket has surplus; attempt to fill deficits in other buckets.
        for (const to of buckets) {
          if (deltaBN[to].isPositive()) {
            // Determine how much we can move.
            const needed = deltaBN[to].abs();
            const available = deltaBN[from].abs();
            const remainingLimit = maxTrade.sub(traded);
            if (remainingLimit.lte(0)) break;
            const amount = BigNumber.from(
              BigNumber.from(needed).lt(available) ? needed : available
            );
            const amountClamped = amount.gt(remainingLimit) ? remainingLimit : amount;
            if (amountClamped.gt(0)) {
              trades.push({ from, to, amount: amountClamped });
              deltaBN[from] = deltaBN[from].add(amountClamped);
              deltaBN[to] = deltaBN[to].sub(amountClamped);
              traded = traded.add(amountClamped);
            }
          }
        }
      }
    }
    // Execute trades sequentially.
    for (const trade of trades) {
      console.log(
        `Swapping ${ethers.utils.formatUnits(trade.amount)} from ${trade.from} to ${trade.to}`
      );
      await this.swapper.swap(
        trade.from,
        trade.to,
        trade.amount,
        this.config.rebalance.slippageMaxPct
      );
    }
  }

  /**
   * Lists NFTs for sale according to the pricing strategy.  For each NFT in
   * the bot's inventory, the bot determines a target listing price based
   * on the collection floor and posts a listing.  It also looks for
   * offers to accept if they meet the minimum threshold.
   */
  private async listNFTs(): Promise<void> {
    const floor = await this.marketplace.getCollectionFloor();
    const nativePrice = await this.oracle.getNativePrice();
    const inventory = await this.marketplace.getInventory();
    for (const nft of inventory) {
      // First, check if there is an acceptable offer.
      const minOffer = floor
        .mul(Math.floor(this.config.pricing.acceptOfferFloorMultiplier * 10000))
        .div(10000);
      const accepted = await this.marketplace.acceptBestOffer(nft, minOffer);
      if (accepted) {
        console.log(`Accepted offer for NFT ${nft}`);
        continue;
      }
      // If no offer, compute the listing price.  Apply delta below floor.
      let price = floor
        .mul(10000 - Math.floor(this.config.pricing.floorFollowDeltaPct * 100))
        .div(10000);
      // Check if listing is stale and apply additional discount.
      const lastListedAt = await this.marketplace.getLastListedAt(nft);
      if (lastListedAt) {
        const daysSince = (Date.now() - lastListedAt) / (1000 * 60 * 60 * 24);
        if (daysSince >= this.config.pricing.staleDaysBeforeDiscount) {
          // Discount an extra 5% for staleness; this is arbitrary and could
          // come from config if desired.
          price = price.mul(95).div(100);
        }
      }
      console.log(
        `Listing NFT ${nft} at ${ethers.utils.formatUnits(price)} (floor=${ethers.utils.formatUnits(
          floor
        )}, nativeUSD=${nativePrice.toFixed(2)})`
      );
      await this.marketplace.listForSale(nft, price);
    }
  }
}

/*
 * Example of how to wire up the TreasuryBot.  In a real implementation
 * you would replace the mock classes below with real Web3 logic and
 * marketplace integrations.  These mocks simply log calls and simulate
 * balances.
 */

// Mock implementation of BalanceProvider for demonstration.
class MockBalanceProvider implements BalanceProvider {
  private state: TreasuryState;
  private gasBalances: { [network: string]: BigNumber };
  constructor() {
    this.state = {
      stable: ethers.utils.parseUnits('6000'),
      native: ethers.utils.parseUnits('3000'),
      beta: ethers.utils.parseUnits('1000'),
    };
    this.gasBalances = {
      ETH: ethers.utils.parseUnits('0.05'),
      TON: ethers.utils.parseUnits('0.5'),
    };
  }
  async getTreasuryState(): Promise<TreasuryState> {
    return this.state;
  }
  async getGasBalances(): Promise<{ [network: string]: BigNumber }> {
    return this.gasBalances;
  }
}

// Mock implementation of Swapper for demonstration.
class MockSwapper implements Swapper {
  async swap(
    from: 'stable' | 'native' | 'beta',
    to: 'stable' | 'native' | 'beta',
    amountIn: BigNumber,
    slippageTolerance: number
  ): Promise<BigNumber> {
    console.log(
      `Mock swap: ${ethers.utils.formatUnits(amountIn)} ${from} → ${to}, slippage tol: ${slippageTolerance}`
    );
    // Simulate that we receive slightly less due to slippage.
    return amountIn.mul(995).div(1000);
  }
}

// Mock implementation of PriceOracle for demonstration.
class MockPriceOracle implements PriceOracle {
  async getNativePrice(): Promise<number> {
    // Suppose the native token is $2.50.
    return 2.5;
  }
  async getNativePriceChange24h(): Promise<number> {
    // Simulate a 3% change.
    return 0.03;
  }
}

// Mock implementation of NFTMarketplace for demonstration.
class MockNFTMarketplace implements NFTMarketplace<string> {
  private floor: BigNumber;
  private inventory: string[];
  private listings: { [id: string]: { price: BigNumber; time: number } };
  constructor() {
    this.floor = ethers.utils.parseUnits('10');
    this.inventory = ['token1', 'token2', 'token3'];
    this.listings = {};
  }
  async getCollectionFloor(): Promise<BigNumber> {
    return this.floor;
  }
  async listForSale(token: string, price: BigNumber): Promise<void> {
    this.listings[token] = { price, time: Date.now() };
    console.log(`Mock listing: ${token} listed at ${ethers.utils.formatUnits(price)}`);
  }
  async acceptBestOffer(token: string, minAcceptablePrice: BigNumber): Promise<boolean> {
    // Simulate no offers.
    return false;
  }
  async getInventory(): Promise<string[]> {
    return this.inventory;
  }
  async getLastListedAt(token: string): Promise<number | undefined> {
    return this.listings[token]?.time;
  }
}

/*
 * If this module is run directly (e.g. via `ts-node`), instantiate the
 * mocks and run the bot once for demonstration purposes.  In production
 * you would import TreasuryBot and provide real implementations.
 */
if (require.main === module) {
  const config: BotConfig = {
    treasuryTargets: { stable: 0.6, native: 0.3, beta: 0.1 },
    gasMinimums: {
      ETH: ethers.utils.parseUnits('0.02'),
      TON: ethers.utils.parseUnits('0.3'),
    },
    rebalance: {
      intervalHours: 6,
      deviationPct: 0.05,
      maxTradePctTreasury: 0.03,
      slippageMaxPct: 0.01,
      priceShockThresholdPct: 0.05,
    },
    pricing: {
      floorFollowDeltaPct: 2,
      acceptOfferFloorMultiplier: 0.95,
      staleDaysBeforeDiscount: 7,
    },
    safety: {
      maxConsecutiveFailures: 3,
      pauseOnGasSpikePct: 2,
    },
  };
  const bot = new TreasuryBot(
    config,
    new MockBalanceProvider(),
    new MockSwapper(),
    new MockPriceOracle(),
    new MockNFTMarketplace()
  );
  // Run once for demonstration instead of scheduling.
  bot
    .start()
    .catch((err) => console.error('Error starting bot:', err));
}

/*
 * README
 * ======
 *
 * To use this bot in your own environment:
 *
 * 1. Install dependencies:
 *    npm install ethers node-cron
 *
 * 2. Provide real implementations for BalanceProvider, Swapper, PriceOracle,
 *    and NFTMarketplace.  These implementations must handle actual
 *    blockchain and marketplace interactions.  The mock classes supplied
 *    here serve as an example.
 *
 * 3. Configure the bot by supplying the BotConfig with your desired
 *    treasury targets, gas minimums, and pricing strategy.
 *
 * 4. Instantiate the TreasuryBot with your config and implementations, then
 *    call start() to begin the periodic tasks.
 *
 * 5. Monitor logs for activity.  The bot writes to console when it
 *    rebalances or lists NFTs.  In production you should integrate a
 *    proper logging solution and persist state as needed.
 */