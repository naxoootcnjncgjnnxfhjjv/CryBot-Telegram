# CryBot Consolidation Roadmap

## Canonical repository

Use this repository as the single source of truth for CryBot Telegram.

Repository: `naxoootcnjncgjnnxfhjjv/CryBot-Telegram`
Branch: `Principal`

## Repositories identified

- `CryBot-Telegram`: canonical Telegram service.
- `crybotfinal`: previous final/web variant.
- `crybot`: empty or minimal duplicate.
- `crybot-prod`: production duplicate.
- `telegram-crybot-v12`: empty or minimal duplicate.

## Target structure

```text
src/
  index.js
  config.js
  bot/
  commands/
  services/
    ton/
    evm/
    aptos/
    ai/
  jobs/
  utils/
docs/
.env.example
package.json
```

## Deployment model

- Railway: long-running Telegram bot service.
- Vercel: optional dashboard or mini app frontend.
- GitHub: single canonical codebase.

## Required secrets

- `BOT_TOKEN` or `TELEGRAM_BOT_TOKEN`
- `OPENAI_API_KEY` optional for AI features
- `TONAPI_KEY` optional for TON scans
- `ETHERSCAN_API_KEY` optional for EVM scans
- `EVM_WALLETS`
- `TON_WALLETS`
- `APTOS_WALLETS`

## Safety rule

The bot must not claim, sell, transfer, or sign transactions unless a separate signer module is explicitly configured and audited. Scanner commands are read-only by default.
