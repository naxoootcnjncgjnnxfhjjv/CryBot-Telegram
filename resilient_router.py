"""
resilient_router.py
====================

This module provides a small framework for building resilient data fetchers and
service clients.  It implements the core concepts described in the user's
specification: circuit breakers, health monitoring, caching, retries and
fallback routing.  The goal is to detect API lag or outages, degrade
gracefully, and automatically reroute requests to alternate providers while
maintaining system stability.

Key features:

* **CircuitBreaker** – Tracks failures over time and trips to an open state when
  a configurable threshold is reached.  After a cool‑down period it enters a
  half‑open state to probe the service for recovery before closing again.  The
  Azure Architecture Center describes the three states of a circuit breaker and
  how they prevent repeated failed requests【424216462570349†L373-L459】.

* **HealthMonitor** – Collects basic metrics such as latency and error rate for
  each provider.  Based on thresholds it calculates a colour (green/amber/red)
  that summarises the health of the upstream API.

* **Provider** – Wraps an asynchronous call function (the actual API request)
  with timeout, retry logic and the circuit breaker.  On each invocation it
  updates the monitor with measured latency and success/failure information.

* **Router** – Holds ordered lists of providers for different categories of
  operations (e.g., NFT floor prices, EVM RPC calls, TON calls).  When a
  request is made, the router iterates over the providers in priority order,
  skipping those whose circuit is open, until it finds a successful result.  If
  all providers fail, the router can fall back to a cached value (if it is
  fresh) to gracefully degrade functionality, consistent with the idea of
  graceful degradation described by GeeksforGeeks【518965599862134†L183-L205】.

The code below is self‑contained and does not depend on external packages.  It
uses ``asyncio`` for concurrency and is designed to be integrated into an
existing bot or service.  See the ``__main__`` section at the end of the file
for a simple demonstration with dummy providers.
"""

from __future__ import annotations

import asyncio
import random
import statistics
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple


class CircuitBreakerState:
    """Enumeration of circuit breaker states."""

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """Simple circuit breaker implementation.

    This class encapsulates the three canonical states described in the
    Circuit Breaker pattern【424216462570349†L413-L459】.  When failures occur
    repeatedly, the breaker opens and blocks further calls.  After a cool‑down
    period it enters a half‑open state to test if the downstream has
    recovered.  If a configurable number of successful calls succeed during
    half‑open it closes again; otherwise it returns to the open state.
    """

    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout: float = 10.0,
        success_threshold: int = 2,
    ) -> None:
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold
        self.state: str = CircuitBreakerState.CLOSED
        self.failure_count: int = 0
        self.success_count: int = 0
        self.opened_at: float = 0.0

    def allow_request(self) -> bool:
        """Return True if a call should be attempted.

        * In the ``CLOSED`` state, all requests are allowed.
        * In the ``OPEN`` state, requests are blocked until the cool‑down
          expires, after which the breaker transitions to ``HALF_OPEN``.
        * In the ``HALF_OPEN`` state, a limited number of requests are
          permitted to probe the downstream service.
        """
        if self.state == CircuitBreakerState.CLOSED:
            return True
        if self.state == CircuitBreakerState.OPEN:
            elapsed = time.monotonic() - self.opened_at
            if elapsed >= self.recovery_timeout:
                # Move to half‑open to test the service.
                self.state = CircuitBreakerState.HALF_OPEN
                self.success_count = 0
                return True
            return False
        if self.state == CircuitBreakerState.HALF_OPEN:
            # Allow a single request at a time in half open.
            return True
        return False

    def record_success(self) -> None:
        """Record a successful call and adjust state if necessary."""
        if self.state == CircuitBreakerState.CLOSED:
            # Reset failures on success in closed state.
            self.failure_count = 0
        elif self.state == CircuitBreakerState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                # Enough successes – close the breaker.
                self.state = CircuitBreakerState.CLOSED
                self.failure_count = 0
                self.success_count = 0

    def record_failure(self) -> None:
        """Record a failed call and adjust state if necessary."""
        if self.state == CircuitBreakerState.CLOSED:
            self.failure_count += 1
            if self.failure_count >= self.failure_threshold:
                # Too many failures – open the breaker.
                self.state = CircuitBreakerState.OPEN
                self.opened_at = time.monotonic()
        elif self.state == CircuitBreakerState.HALF_OPEN:
            # On failure during half open, trip again.
            self.state = CircuitBreakerState.OPEN
            self.opened_at = time.monotonic()
            self.failure_count = 0
            self.success_count = 0

    def __repr__(self) -> str:
        return f"<CircuitBreaker state={self.state} failures={self.failure_count} successes={self.success_count}>"


@dataclass
class HealthMonitor:
    """Collects metrics for a provider and computes a health colour.

    The monitor keeps a sliding window of recent latencies and success flags.
    It computes the 95th percentile (p95) latency and error rate over the window.
    Colour thresholds are configurable; red indicates high error rates or stale
    data, amber indicates moderate issues, and green means healthy.
    """

    window_size: int = 50
    latencies: deque = field(default_factory=lambda: deque(maxlen=50))
    successes: deque = field(default_factory=lambda: deque(maxlen=50))
    last_block_age: Optional[float] = None  # Age in seconds of the latest block.
    # Thresholds for colours.
    max_green_latency: float = 1.5  # seconds
    max_amber_latency: float = 3.0  # seconds
    max_green_error: float = 0.05
    max_amber_error: float = 0.2
    max_block_lag: float = 3.0  # blocks or seconds

    def record(self, latency: float, success: bool, block_age: Optional[float] = None) -> None:
        """Add a single observation to the window."""
        self.latencies.append(latency)
        self.successes.append(success)
        if block_age is not None:
            self.last_block_age = block_age

    @property
    def error_rate(self) -> float:
        if not self.successes:
            return 0.0
        failures = self.successes.count(False)
        return failures / len(self.successes)

    @property
    def p95_latency(self) -> float:
        if not self.latencies:
            return 0.0
        # Compute 95th percentile; if fewer than 2 values, return mean.
        sorted_lats = sorted(self.latencies)
        k = int(0.95 * (len(sorted_lats) - 1))
        return sorted_lats[k]

    @property
    def colour(self) -> str:
        """Compute a traffic light colour summarising health."""
        lat = self.p95_latency
        err = self.error_rate
        # Determine block lag if provided
        block_lag = self.last_block_age or 0.0
        if err >= self.max_amber_error or lat >= self.max_amber_latency or block_lag > self.max_block_lag:
            return "red"
        if err >= self.max_green_error or lat >= self.max_green_latency:
            return "amber"
        return "green"

    def __repr__(self) -> str:
        return (
            f"<HealthMonitor p95={self.p95_latency:.3f}s error_rate={self.error_rate:.2%} block_lag={self.last_block_age} "
            f"colour={self.colour}>"
        )


class Provider:
    """Represents an upstream provider with resiliency features.

    Each provider wraps an asynchronous ``call_func`` that performs the actual
    work (e.g., making an HTTP request).  The provider enforces a timeout,
    performs retries with exponential backoff, records metrics via the
    ``HealthMonitor`` and updates the ``CircuitBreaker`` state depending on
    successes or failures.  If the breaker is open, the provider will not
    attempt the call and will instead raise ``CircuitOpenError``.
    """

    def __init__(
        self,
        name: str,
        call_func: Callable[..., Awaitable],
        timeout: float = 1.2,
        max_retries: int = 2,
        backoff_base: float = 0.3,
        breaker: Optional[CircuitBreaker] = None,
        monitor: Optional[HealthMonitor] = None,
    ) -> None:
        self.name = name
        self.call_func = call_func
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_base = backoff_base
        self.breaker = breaker or CircuitBreaker()
        self.monitor = monitor or HealthMonitor()

    async def request(self, *args: Any, **kwargs: Any) -> Any:
        """Execute the wrapped call with retries, timeouts and circuit logic.

        Returns the data on success or raises an exception on failure.
        """
        if not self.breaker.allow_request():
            raise CircuitOpenError(f"Circuit open for provider {self.name}")

        attempt = 0
        backoff = self.backoff_base
        while True:
            attempt += 1
            start_time = time.monotonic()
            try:
                # Wrap the call in asyncio.wait_for to enforce timeout.
                result = await asyncio.wait_for(
                    self.call_func(*args, **kwargs), timeout=self.timeout
                )
            except Exception as exc:
                # Record failure and update circuit breaker.
                latency = time.monotonic() - start_time
                self.monitor.record(latency, False)
                self.breaker.record_failure()
                if attempt > self.max_retries:
                    raise ProviderError(f"{self.name} failed after {attempt} attempts") from exc
                # Wait before retrying with jitter.
                jitter = random.uniform(0, backoff)
                await asyncio.sleep(backoff + jitter)
                backoff *= 2  # Exponential backoff
                continue
            else:
                # Success: record metrics and update circuit breaker.
                latency = time.monotonic() - start_time
                self.monitor.record(latency, True)
                self.breaker.record_success()
                return result

    def __repr__(self) -> str:
        return f"<Provider name={self.name} breaker={self.breaker} monitor={self.monitor}>"


class Router:
    """Routes requests across multiple providers based on priority and health.

    Each category (e.g., ``prices``, ``ton``, ``evm``) maps to an ordered list
    of providers.  The router tries providers in order, skipping any whose
    circuits are open.  If a call succeeds it caches the result.  If all
    providers fail, the router returns a cached value if available and within
    TTL to provide graceful degradation【518965599862134†L183-L205】.
    """

    def __init__(self, cache_ttl: Dict[str, float] | None = None) -> None:
        self.providers: Dict[str, List[Provider]] = {}
        # Cache mapping category → (timestamp, value)
        self.cache: Dict[str, Tuple[float, Any]] = {}
        self.cache_ttl = cache_ttl or {}

    def register(self, category: str, provider: Provider) -> None:
        """Register a provider for a given category.  Providers are appended in priority order."""
        self.providers.setdefault(category, []).append(provider)

    async def execute(self, category: str, *args: Any, **kwargs: Any) -> Tuple[Any, bool]:
        """Execute a request against the providers for the category.

        Returns a tuple ``(result, from_cache)``.  If ``from_cache`` is True,
        the router returned a degraded value from its cache because all providers
        failed or were unhealthy.  If there is no cached value available,
        ``ProviderError`` is raised.
        """
        providers = self.providers.get(category) or []
        # Try each provider in order.
        for provider in providers:
            try:
                result = await provider.request(*args, **kwargs)
            except CircuitOpenError:
                # Skip this provider if its circuit is open.
                continue
            except ProviderError:
                # Provider had a fatal error; skip to next.
                continue
            else:
                # Cache result and return.
                self.cache[category] = (time.monotonic(), result)
                return result, False
        # All providers failed or were open – try cache.
        cache_entry = self.cache.get(category)
        ttl = self.cache_ttl.get(category, 0)
        if cache_entry:
            ts, value = cache_entry
            if (time.monotonic() - ts) <= ttl:
                # Return degraded value.
                return value, True
        raise ProviderError(f"No available provider succeeded for category {category}")

    def status(self) -> Dict[str, List[Dict[str, Any]]]:
        """Return a snapshot of provider status for each category.

        Each provider entry includes its current circuit state, p95 latency,
        error rate and computed health colour.  This can be used to feed a
        monitoring dashboard or bot commands like `/estado`.
        """
        report: Dict[str, List[Dict[str, Any]]] = {}
        for cat, providers in self.providers.items():
            entries: List[Dict[str, Any]] = []
            for p in providers:
                entries.append(
                    {
                        "name": p.name,
                        "state": p.breaker.state,
                        "p95_ms": round(p.monitor.p95_latency * 1000, 2),
                        "error_rate": round(p.monitor.error_rate, 4),
                        "colour": p.monitor.colour,
                    }
                )
            report[cat] = entries
        return report


class ProviderError(Exception):
    """Raised when a provider fails irrecoverably."""


class CircuitOpenError(Exception):
    """Raised when a call is attempted but the circuit breaker is open."""


# Dummy provider functions for demonstration.
async def dummy_opensea_call(collection: str) -> float:
    """Simulate an API call to retrieve a floor price from OpenSea.

    Randomly sleeps up to 0.4 seconds and sometimes fails to illustrate
    behaviour.  Returns a float representing the floor price.
    """
    # Simulate network latency
    await asyncio.sleep(random.uniform(0.05, 0.4))
    # 15% chance of raising an exception to simulate API failure
    if random.random() < 0.15:
        raise RuntimeError("OpenSea API error")
    # Return a dummy price
    return random.uniform(0.9, 1.1) * 100


async def dummy_blur_call(collection: str) -> float:
    """Simulate an API call to retrieve a floor price from Blur.

    Slightly higher failure rate than OpenSea.
    """
    await asyncio.sleep(random.uniform(0.05, 0.5))
    if random.random() < 0.25:
        raise RuntimeError("Blur API error")
    return random.uniform(0.85, 1.15) * 100


async def dummy_cache_call(collection: str) -> float:
    """Return a cached price from a local store.

    This provider always succeeds and is used as a final fallback.  It
    intentionally returns a slightly stale value to illustrate degradation.
    """
    await asyncio.sleep(0.01)
    return 95.0  # static fallback value


async def run_demo() -> None:
    """Run a simple demonstration of the router and providers.

    Creates a router with three price providers: OpenSea (primary), Blur
    (secondary) and a cache (tertiary).  Executes several price fetches in
    succession to show how metrics, circuit breakers and caching work.  The
    demonstration prints the status after each call.  To exit the demo
    gracefully in this environment, we limit the number of iterations.
    """
    router = Router(cache_ttl={"prices": 60.0})
    # Register providers in order of priority
    router.register(
        "prices",
        Provider(
            name="opensea",
            call_func=dummy_opensea_call,
            timeout=1.0,
            max_retries=2,
            backoff_base=0.3,
            breaker=CircuitBreaker(failure_threshold=3, recovery_timeout=5.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=0.8, max_amber_latency=1.5, max_green_error=0.05, max_amber_error=0.2),
        ),
    )
    router.register(
        "prices",
        Provider(
            name="blur",
            call_func=dummy_blur_call,
            timeout=1.0,
            max_retries=2,
            backoff_base=0.3,
            breaker=CircuitBreaker(failure_threshold=2, recovery_timeout=5.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=0.8, max_amber_latency=1.5, max_green_error=0.1, max_amber_error=0.3),
        ),
    )
    router.register(
        "prices",
        Provider(
            name="cache",
            call_func=dummy_cache_call,
            timeout=0.2,
            max_retries=0,
            backoff_base=0.1,
            breaker=CircuitBreaker(failure_threshold=1, recovery_timeout=5.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=0.5, max_amber_latency=1.0, max_green_error=0.0, max_amber_error=0.1),
        ),
    )

    # Perform multiple requests
    for i in range(10):
        try:
            price, from_cache = await router.execute("prices", "my_collection")
            source = "cache" if from_cache else "provider"
            print(f"Request {i+1}: price={price:.2f} (from {source})")
        except ProviderError as err:
            print(f"Request {i+1}: failed → {err}")
        # Display status snapshot
        print("Status:", router.status())
        # Short pause between requests
        await asyncio.sleep(0.5)


if __name__ == "__main__":
    # When executed directly, run the demo.
    try:
        asyncio.run(run_demo())
    except KeyboardInterrupt:
        pass