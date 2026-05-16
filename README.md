# CryBot-Telegram

CryBot Telegram is being migrated into a modular multi-chain Telegram automation platform.

Current runtime:

- Node.js ESM
- Express webhook server
- Telegraf Telegram bot
- Modular runtime structure

---

## Current Runtime Entry

Primary runtime:

```bash
npm start
```

This launches:

```txt
src/index.js
```

Legacy runtime files still exist temporarily for migration compatibility.

---

## Current Structure

```txt
src/
├── bot/
├── chains/
├── core/
├── jobs/
├── services/
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
TONAPI_KEY=
ETHERSCAN_API_KEY=
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

### Write Mode

Must be manually enabled.

```env
ENABLE_WRITE_ACTIONS=false
```

---

## Available Commands

- /ping
- /status
- /wallets

Additional commands will migrate progressively from the legacy runtime.

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

---

## Planned Architecture

Target structure:

```txt
apps/
├── telegram-bot
├── scanner-worker
└── cron-worker
```

Recommended stack:

- Railway
- PostgreSQL
- Prisma
- Redis
- GitHub Actions

---

## Migration Status

Migration in progress.

Legacy CommonJS files still coexist with the new ESM runtime and will progressively move into:

```txt
_archive/
```
