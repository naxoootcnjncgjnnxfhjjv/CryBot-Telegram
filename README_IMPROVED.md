# crybot / TON tx helper (IMPROVED)

Cambios clave:
- Validación de direcciones con `Address.parse`.
- Evita coma flotante: usa `toNanoSafe()` (bigint) y `GAS_BUFFER_TON`.
- `TON_NETWORK` configurable (`mainnet`/`testnet`).
- Manejo de errores tipado (`unknown`) y mensajes claros.
- `txHash` devuelve `seqno_*` como referencia (la librería no expone hash directo).
- Ejecución directa con variables DEMO_*.

## Variables de entorno
- `TON_MNEMONIC` (obligatorio): 12+ palabras.
- `TON_NETWORK` (opcional): `mainnet` (default) o `testnet`.
- `GAS_BUFFER_TON` (opcional): ej. `"0.1"`.
- (para el ejemplo) `DEMO_COLLECTION`, `DEMO_TOKEN_ID`, `DEMO_FROM`, `DEMO_PRICE_TON`.

## Uso rápido
```bash
# Instala deps (suponiendo proyecto TS con ton / ton-crypto / @orbs-network/ton-access)
npm i ton ton-crypto @orbs-network/ton-access

# Ejecutar (ts-node) o compilar y ejecutar
TON_MNEMONIC="palabra1 palabra2 ..." node dist/src/ton/tx.js
```

## Nota
El cuerpo del mensaje (`body`) mantiene Buffer como en la versión original. Para integraciones reales con un marketplace TON, convendría construir celdas (`beginCell`) según el contrato.
