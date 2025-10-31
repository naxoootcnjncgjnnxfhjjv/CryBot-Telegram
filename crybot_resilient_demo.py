"""
crybot_resilient_demo.py
========================

This script demonstrates how to integrate the ``resilient_router`` module into a
simple bot‑like workflow.  It creates a ``Router`` with multiple categories
(``prices``, ``ton``, ``evm`` and ``bridges``) and registers dummy providers
for each category.  It then exposes a minimal command interface using
``asyncio`` to simulate bot commands such as fetching prices, bridging tokens,
checking provider status and toggling a pause for sensitive operations.

The aim is to show how the circuit breaker, health monitor, caching and
fallback logic from ``resilient_router`` can be integrated into a real
application.  In your own bot, replace the dummy provider functions with
asynchronous calls to OpenSea, Blur, tonapi.io, Etherscan/Alchemy, and your
bridges.  The thresholds on each ``CircuitBreaker`` and ``HealthMonitor`` can
also be tuned to suit your environment.

Run this script directly to launch the demonstration.  Type ``help`` at the
prompt to see available commands.
"""

import asyncio
import random
import time
from typing import Any, Dict, Tuple

from resilient_router import (
    Router,
    Provider,
    CircuitBreaker,
    HealthMonitor,
    ProviderError,
    CircuitOpenError,
)


# ---------------------------------------------------------------------------
# Dummy provider implementations
#
# In a production system you would implement these functions to perform the
# actual RPC or API calls.  Here we simulate latencies and errors for
# demonstration purposes.

async def get_floor_price_from_opensea(collection: str) -> float:
    await asyncio.sleep(random.uniform(0.05, 0.4))
    if random.random() < 0.1:
        raise RuntimeError("OpenSea unavailable")
    return random.uniform(0.9, 1.1) * 100


async def get_floor_price_from_blur(collection: str) -> float:
    await asyncio.sleep(random.uniform(0.05, 0.6))
    if random.random() < 0.2:
        raise RuntimeError("Blur API error")
    return random.uniform(0.85, 1.15) * 100


async def get_floor_price_from_cache(collection: str) -> float:
    await asyncio.sleep(0.02)
    return 95.0


async def get_ton_balance_from_tonapi(address: str) -> float:
    await asyncio.sleep(random.uniform(0.05, 0.3))
    if random.random() < 0.05:
        raise RuntimeError("tonapi timeout")
    return random.uniform(50, 100)


async def get_ton_balance_from_toncenter(address: str) -> float:
    await asyncio.sleep(random.uniform(0.05, 0.4))
    if random.random() < 0.1:
        raise RuntimeError("toncenter error")
    return random.uniform(48, 102)


async def get_ton_balance_from_local(address: str) -> float:
    await asyncio.sleep(0.02)
    return 50.0


async def get_eth_balance_from_etherscan(address: str) -> float:
    await asyncio.sleep(random.uniform(0.05, 0.4))
    if random.random() < 0.1:
        raise RuntimeError("etherscan error")
    return random.uniform(1, 3)


async def get_eth_balance_from_alchemy(address: str) -> float:
    await asyncio.sleep(random.uniform(0.05, 0.4))
    if random.random() < 0.15:
        raise RuntimeError("alchemy error")
    return random.uniform(0.9, 2.7)


async def get_eth_balance_from_local(address: str) -> float:
    await asyncio.sleep(0.02)
    return 1.5


async def bridge_via_a(amount: float, from_chain: str, to_chain: str) -> str:
    await asyncio.sleep(random.uniform(0.1, 0.6))
    if random.random() < 0.15:
        raise RuntimeError("Bridge A failure")
    return f"tx_hash_{int(time.time()*1000)}"


async def bridge_via_b(amount: float, from_chain: str, to_chain: str) -> str:
    await asyncio.sleep(random.uniform(0.1, 0.8))
    if random.random() < 0.2:
        raise RuntimeError("Bridge B failure")
    return f"tx_hash_{int(time.time()*1000)}"


async def bridge_stub(amount: float, from_chain: str, to_chain: str) -> str:
    await asyncio.sleep(0.05)
    return "stub_tx"


# ---------------------------------------------------------------------------
# Router setup

def build_router() -> Router:
    """Create and configure a router with providers for different categories."""
    router = Router(cache_ttl={"prices": 60.0, "ton": 30.0, "evm": 30.0, "bridges": 300.0})

    # Prices
    router.register(
        "prices",
        Provider(
            name="opensea",
            call_func=get_floor_price_from_opensea,
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
            call_func=get_floor_price_from_blur,
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
            call_func=get_floor_price_from_cache,
            timeout=0.2,
            max_retries=0,
            backoff_base=0.1,
            breaker=CircuitBreaker(failure_threshold=1, recovery_timeout=5.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=0.5, max_amber_latency=1.0, max_green_error=0.0, max_amber_error=0.1),
        ),
    )

    # TON balances
    router.register(
        "ton",
        Provider(
            name="tonapi",
            call_func=get_ton_balance_from_tonapi,
            timeout=0.8,
            max_retries=2,
            backoff_base=0.3,
            breaker=CircuitBreaker(failure_threshold=2, recovery_timeout=5.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=0.6, max_amber_latency=1.2, max_green_error=0.05, max_amber_error=0.2),
        ),
    )
    router.register(
        "ton",
        Provider(
            name="toncenter",
            call_func=get_ton_balance_from_toncenter,
            timeout=0.8,
            max_retries=2,
            backoff_base=0.3,
            breaker=CircuitBreaker(failure_threshold=2, recovery_timeout=5.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=0.6, max_amber_latency=1.2, max_green_error=0.05, max_amber_error=0.2),
        ),
    )
    router.register(
        "ton",
        Provider(
            name="ton_local",
            call_func=get_ton_balance_from_local,
            timeout=0.3,
            max_retries=0,
            backoff_base=0.1,
            breaker=CircuitBreaker(failure_threshold=1, recovery_timeout=5.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=0.3, max_amber_latency=0.8, max_green_error=0.0, max_amber_error=0.1),
        ),
    )

    # EVM balances
    router.register(
        "evm",
        Provider(
            name="etherscan",
            call_func=get_eth_balance_from_etherscan,
            timeout=0.8,
            max_retries=2,
            backoff_base=0.3,
            breaker=CircuitBreaker(failure_threshold=2, recovery_timeout=5.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=0.6, max_amber_latency=1.2, max_green_error=0.05, max_amber_error=0.2),
        ),
    )
    router.register(
        "evm",
        Provider(
            name="alchemy",
            call_func=get_eth_balance_from_alchemy,
            timeout=0.8,
            max_retries=2,
            backoff_base=0.3,
            breaker=CircuitBreaker(failure_threshold=2, recovery_timeout=5.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=0.6, max_amber_latency=1.2, max_green_error=0.05, max_amber_error=0.2),
        ),
    )
    router.register(
        "evm",
        Provider(
            name="evm_local",
            call_func=get_eth_balance_from_local,
            timeout=0.3,
            max_retries=0,
            backoff_base=0.1,
            breaker=CircuitBreaker(failure_threshold=1, recovery_timeout=5.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=0.3, max_amber_latency=0.8, max_green_error=0.0, max_amber_error=0.1),
        ),
    )

    # Bridges
    router.register(
        "bridges",
        Provider(
            name="bridgeA",
            call_func=bridge_via_a,
            timeout=1.5,
            max_retries=2,
            backoff_base=0.5,
            breaker=CircuitBreaker(failure_threshold=2, recovery_timeout=10.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=1.0, max_amber_latency=2.0, max_green_error=0.05, max_amber_error=0.2),
        ),
    )
    router.register(
        "bridges",
        Provider(
            name="bridgeB",
            call_func=bridge_via_b,
            timeout=1.5,
            max_retries=2,
            backoff_base=0.5,
            breaker=CircuitBreaker(failure_threshold=2, recovery_timeout=10.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=1.0, max_amber_latency=2.0, max_green_error=0.05, max_amber_error=0.2),
        ),
    )
    router.register(
        "bridges",
        Provider(
            name="stub",
            call_func=bridge_stub,
            timeout=0.4,
            max_retries=0,
            backoff_base=0.1,
            breaker=CircuitBreaker(failure_threshold=1, recovery_timeout=10.0, success_threshold=1),
            monitor=HealthMonitor(max_green_latency=0.4, max_amber_latency=1.0, max_green_error=0.0, max_amber_error=0.1),
        ),
    )

    return router


class Bot:
    """A simple bot wrapper around the router with pause functionality."""

    def __init__(self) -> None:
        self.router = build_router()
        # Flags to pause sensitive operations like sales or bridging
        self.paused_prices = False
        self.paused_bridges = False

    async def handle_command(self, cmd: str, *args: str) -> None:
        """Handle a user command typed in the CLI."""
        if cmd == "/estado":
            status = self.router.status()
            for category, entries in status.items():
                print(f"{category}:")
                for e in entries:
                    print(
                        f"  {e['name']:10} state={e['state']:<6} p95_ms={e['p95_ms']:<5} err_rate={e['error_rate']:<5} colour={e['colour']}"
                    )
        elif cmd == "/pausar_ventas":
            if not args:
                print("Especifica 'on' o 'off'.")
                return
            if args[0] == "on":
                self.paused_prices = True
                print("Ventas y listados pausados.")
            elif args[0] == "off":
                self.paused_prices = False
                print("Ventas y listados reanudados.")
            else:
                print("Argumento no reconocido. Usa 'on' o 'off'.")
        elif cmd == "/pausar_bridges":
            if not args:
                print("Especifica 'on' o 'off'.")
                return
            if args[0] == "on":
                self.paused_bridges = True
                print("Puentes pausados.")
            elif args[0] == "off":
                self.paused_bridges = False
                print("Puentes reanudados.")
            else:
                print("Argumento no reconocido. Usa 'on' o 'off'.")
        elif cmd == "/precio":
            collection = args[0] if args else "default_collection"
            if self.paused_prices:
                print("🚫 Operación de precios pausada.")
                return
            try:
                price, from_cache = await self.router.execute("prices", collection)
                print(
                    f"Precio floor de {collection}: {price:.2f} TON{' (caché)' if from_cache else ''}"
                )
            except ProviderError as exc:
                print(f"Error obteniendo precio: {exc}")
        elif cmd == "/balance_ton":
            address = args[0] if args else "address"
            try:
                balance, from_cache = await self.router.execute("ton", address)
                print(
                    f"Balance TON para {address}: {balance:.2f}{' (caché)' if from_cache else ''}"
                )
            except ProviderError as exc:
                print(f"Error obteniendo balance TON: {exc}")
        elif cmd == "/balance_evm":
            address = args[0] if args else "0x0"
            try:
                balance, from_cache = await self.router.execute("evm", address)
                print(
                    f"Balance EVM para {address}: {balance:.3f} ETH{' (caché)' if from_cache else ''}"
                )
            except ProviderError as exc:
                print(f"Error obteniendo balance EVM: {exc}")
        elif cmd == "/bridge":
            if len(args) < 3:
                print("Uso: /bridge cantidad cadena_origen cadena_destino")
                return
            amount = float(args[0])
            from_chain = args[1]
            to_chain = args[2]
            if self.paused_bridges:
                print("🚫 Operación de puente pausada.")
                return
            try:
                tx_hash, from_cache = await self.router.execute("bridges", amount, from_chain, to_chain)
                print(
                    f"Transferencia de {amount} de {from_chain} a {to_chain} realizada. Tx: {tx_hash}{' (caché)' if from_cache else ''}"
                )
            except ProviderError as exc:
                print(f"Error al puentear: {exc}")
        elif cmd == "help":
            print("Comandos disponibles:")
            print("  /estado                               -> muestra el estado de los proveedores")
            print("  /pausar_ventas on|off                 -> pausa/reanuda las operaciones de precios")
            print("  /pausar_bridges on|off                -> pausa/reanuda las operaciones de puentes")
            print("  /precio [colección]                   -> obtiene el floor price de una colección")
            print("  /balance_ton [dirección]              -> obtiene el balance de TON")
            print("  /balance_evm [dirección]              -> obtiene el balance en la red EVM")
            print("  /bridge cantidad desde hacia         -> realiza un puente entre cadenas")
            print("  help                                  -> muestra esta ayuda")
            print("  exit                                  -> salir")
        elif cmd == "exit":
            raise SystemExit
        else:
            print("Comando no reconocido. Escribe 'help' para ver comandos.")


async def main() -> None:
    bot = Bot()
    print("Bot resiliente listo. Escribe 'help' para ver comandos.")
    while True:
        try:
            user_input = input("$ ").strip()
        except EOFError:
            break
        if not user_input:
            continue
        parts = user_input.split()
        cmd = parts[0]
        args = parts[1:]
        try:
            await bot.handle_command(cmd, *args)
        except Exception as exc:
            print(f"Excepción inesperada: {exc}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nHasta luego!")