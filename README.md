# CryBot-Telegram

CryBot Telegram is a modular multi-chain Telegram backend.

Current runtime:

- Node.js ESM
- Express webhook server
- Telegraf Telegram bot
- Modular runtime structure
- Read-only blockchain balance scanning

---

## Current Runtime Entry

Primary runtime:

```bash
npm start
```

Safe runtime:

```bash
npm run start:safe
```

This launches:

```txt
src/index.js
```

---

## Current Structure

```txt
src/
├── bot/
├── chains/
│   ├── aptos.js
│   ├── evm.js
│   └── ton.js
├── core/
├── jobs/
├── services/
├── workers/
└── index.js
```

---

## Environment

Use:

```bash
cp .env.example .env
```

Required variables:

```env
BOT_TOKEN=
BASE_URL=
```

Optional API variables:

```env
TONAPI_KEY=
ETHERSCAN_API_KEY=
RPC_URL=
```

Wallet lists:

```env
TON_WALLETS=
EVM_WALLETS=
APTOS_WALLETS=
```

---

## Runtime Modes

### Dry Run

Safe mode.

No irreversible blockchain actions.

```env
DRY_RUN=true
```

### Write Mode

Must be manually enabled.

```env
ENABLE_WRITE_ACTIONS=false
```

Write mode is not used by the current read-only scanner.

---

## Available Telegram Commands

- /ping
- /status
- /wallets
- /inventory
- /balances

---

## NPM Commands

```bash
npm run check
npm run validate
npm run audit
npm run scanner
npm run scanner:loop
npm run start:safe
```

---

## Health Endpoint

```txt
/health
```

---

## Security Rules

Never commit:

- private keys
- mnemonic seeds
- production secrets
- API tokens

Everything must remain in environment variables.

Current production posture:

- read-only
- dry-run by default
- no automatic claims
- no automatic sells
- no automatic transfers

---

## CI

GitHub Actions validates:

- npm install
- syntax checks
- runtime validation
- structure audit
- scanner execution

---

## Migration Status

Legacy files still exist and must not be used as production entrypoints:

```txt
server-express.js
config.js
improved_index.js
```

Production entrypoint is:

```txt
src/index.js
```
