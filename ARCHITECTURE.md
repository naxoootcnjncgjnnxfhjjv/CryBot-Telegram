# CryBot Architecture

## Runtime Layers

CryBot is being migrated from a legacy mixed architecture into a modular runtime.

Target architecture:

- Telegram bot layer
- Blockchain abstraction layer
- Marketplace integrations
- Scanner workers
- Scheduled jobs
- Storage layer
- Notification layer

---

## Planned Structure

```txt
src/
├── app/
├── bot/
├── chains/
├── commands/
├── core/
├── jobs/
├── services/
└── utils/
```

---

## Security Rules

The repository must NEVER contain:

- private keys
- mnemonic seeds
- production secrets
- hardcoded API tokens

Everything must be injected through environment variables.

---

## Runtime Modes

### Dry Run

Safe mode.

No irreversible blockchain actions.

### Write Mode

Only enabled manually through environment flags.

---

## Planned Workers

### telegram-bot

Handles Telegram commands and notifications.

### scanner-worker

Scans wallets, NFTs and balances.

### cron-worker

Runs recurring scheduled jobs.

---

## Planned Databases

Recommended:

- PostgreSQL
- Prisma ORM
- Redis (optional)

---

## Deployment

Recommended infrastructure:

- Railway -> backend/workers
- Vercel -> frontend/dashboard
- GitHub Actions -> CI/CD

---

## Current Status

Migration in progress.

Legacy CommonJS modules still exist and should progressively move into:

```txt
_archive/
```
