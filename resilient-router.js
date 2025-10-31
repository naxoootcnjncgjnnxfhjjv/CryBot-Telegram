/*
 * Resilient router and circuit breaker utilities for Node.js.
 *
 * This module implements a simple CircuitBreaker class and a Router
 * that can orchestrate calls to multiple providers with fallbacks.
 * Each provider is wrapped in a CircuitBreaker to detect and
 * isolate failing dependencies. When a provider repeatedly fails,
 * its circuit opens and the router will skip it until a cooldown
 * period elapses.
 *
 * The design is inspired by the Python implementation used in
 * crybot_resilient_demo.py and adapted for JavaScript.
 */

class CircuitBreaker {
  /**
   * Construct a new CircuitBreaker.
   *
   * @param {Object} options
   * @param {number} [options.failureThreshold=3] - number of consecutive failures before opening the circuit
   * @param {number} [options.successThreshold=1] - number of consecutive successes required to close a half‑open circuit
   * @param {number} [options.cooldownTime=30000] - cooldown time in milliseconds before transitioning from OPEN to HALF_OPEN
   */
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.successThreshold = options.successThreshold ?? 1;
    this.cooldownTime = options.cooldownTime ?? 30000; // default 30 seconds

    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Determine whether the circuit can make a request.
   * If the circuit is OPEN and the cooldown has not passed, the circuit is not ready.
   * @returns {boolean}
   */
  canRequest() {
    if (this.state === 'OPEN') {
      const now = Date.now();
      return now - this.lastFailureTime >= this.cooldownTime;
    }
    return true;
  }

  /**
   * Execute a function through the circuit breaker. If the circuit is OPEN and
   * not yet ready, it rejects immediately. On failure it increments the failure
   * count and may open the circuit. On success it resets counters and may
   * close a half‑open circuit.
   *
   * @param {Function} fn - asynchronous function to invoke
   * @param {...any} args - arguments to pass to the function
   * @returns {Promise<any>}
   */
  async exec(fn, ...args) {
    if (!this.canRequest()) {
      throw new Error('Circuit is open');
    }
    // If cooldown has passed, allow one trial in HALF_OPEN state
    if (this.state === 'OPEN' && this.canRequest()) {
      this.state = 'HALF_OPEN';
    }
    try {
      const result = await fn(...args);
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  /**
   * Handle a successful call.
   */
  _onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount += 1;
      if (this.successCount >= this.successThreshold) {
        this._close();
      }
    } else {
      // Reset on any success in CLOSED state
      this.failureCount = 0;
    }
  }

  /**
   * Handle a failed call.
   */
  _onFailure() {
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this._open();
    }
  }

  /**
   * Open the circuit. Reject all requests until cooldown.
   */
  _open() {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
    this.failureCount = 0;
    this.successCount = 0;
  }

  /**
   * Close the circuit. Reset counters.
   */
  _close() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
  }
}

/**
 * Simple provider wrapper that binds a name, function and circuit breaker.
 */
class Provider {
  /**
   * Create a provider.
   *
   * @param {string} name - Identifier for the provider
   * @param {Function} func - Asynchronous function that performs the provider call
   * @param {Object} [options] - Circuit breaker options
   */
  constructor(name, func, options = {}) {
    this.name = name;
    this.func = func;
    this.circuit = new CircuitBreaker(options);
  }

  async call(...args) {
    return this.circuit.exec(this.func, ...args);
  }
}

/**
 * Router orchestrates multiple providers in a category. If one provider fails,
 * the router will try the next provider in order. Providers with open circuits
 * are skipped until their cooldown period expires. If all providers fail,
 * the router throws an error.
 */
class Router {
  constructor() {
    /**
     * Map of category → array of providers
     * @type {Map<string, Provider[]>}
     */
    this.categories = new Map();
  }

  /**
   * Register a provider for a specific category.
   *
   * @param {string} category
   * @param {Provider} provider
   */
  addProvider(category, provider) {
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    this.categories.get(category).push(provider);
  }

  /**
   * Invoke providers for a category until one succeeds.
   *
   * @param {string} category
   * @param {...any} args - Arguments to pass to each provider
   * @returns {Promise<any>}
   */
  async call(category, ...args) {
    const providers = this.categories.get(category) || [];
    if (providers.length === 0) {
      throw new Error(`No providers registered for category: ${category}`);
    }
    let lastError = null;
    for (const provider of providers) {
      try {
        const result = await provider.call(...args);
        return result;
      } catch (err) {
        lastError = err;
        // fall through to next provider
      }
    }
    // If we reach here, all providers failed
    throw lastError || new Error(`All providers failed for category: ${category}`);
  }
}

module.exports = { CircuitBreaker, Provider, Router };