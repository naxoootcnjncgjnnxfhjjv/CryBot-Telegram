# Rotación de tokens y despliegue seguro

## Motivo

El proyecto es antiguo y puede haber tokens, variables o bots anteriores. Cualquier secreto que haya estado en GitHub, Glitch, Railway antiguo, Vercel o capturas debe considerarse expuesto.

## Cambios obligatorios

### 1. Telegram

Crear o regenerar token en BotFather:

- Abrir Telegram.
- Entrar en `@BotFather`.
- Usar `/mybots`.
- Seleccionar el bot correcto.
- `API Token`.
- `Revoke current token`.
- Copiar el token nuevo.

En Railway usar una de estas variables:

```env
TELEGRAM_BOT_TOKEN=TOKEN_NUEVO
BOT_TOKEN=TOKEN_NUEVO
```

La config acepta ambas.

### 2. TonAPI

Generar nueva API key si la anterior se compartió.

```env
TONAPI_KEY=KEY_NUEVA
TON_API_KEY=KEY_NUEVA
```

### 3. Etherscan / RPC

Rotar claves antiguas si estuvieron en chats, `.env`, logs o capturas.

```env
ETHERSCAN_API_KEY=KEY_NUEVA
RPC_URL=https://ethereum.publicnode.com
```

### 4. Wallets

No usar seed phrase ni private key en este proyecto mientras esté en fase de inventario.

Variables seguras:

```env
TON_WALLETS=wallet1,wallet2,wallet3
EVM_WALLETS=wallet1,wallet2
APTOS_WALLETS=wallet1
```

Wallets TON prioritarias:

```text
UQChtGxrxo1H74kGde0GNsSKWYG_rhGMKNco-opmWQ1B-yil
UQDXGQp2nDtUb985loKLV-AK8q0qyGK9D0vixyUUd4aWVvLE
```

Wallet `UQBCmTw...` debe quedar solo lectura hasta confirmar control real.

### 5. Flags de seguridad

Mantener:

```env
DRY_RUN=true
ENABLE_WRITE_ACTIONS=false
```

No cambiar hasta tener inventario completo, precios reales y confirmación manual.

## Comandos de verificación

```bash
npm install
npm run check
npm run validate
npm run scanner
npm start
```

En Telegram:

```text
/status
/wallets
/balances
/nfts
```

## Regla final

No guardar secretos en GitHub. Usar variables de entorno en Railway/Vercel/local.
