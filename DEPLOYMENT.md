# CryBot Deployment

## Production Runtime

Use this command in Railway:

```bash
npm run start:safe
```

Fallback command:

```bash
npm start
```

## Scanner Worker

Optional scanner worker:

```bash
npm run scanner
```

Continuous scanner mode:

```bash
npm run scanner:loop
```

## Do Not Use

The following legacy files must not be used as start commands:

```txt
server-express.js
improved_index.js
config.js
```

## Required Variables

```env
BOT_TOKEN=
BASE_URL=
WEBHOOK_PATH=/webhook
DRY_RUN=true
ENABLE_WRITE_ACTIONS=false
```

## Optional Variables

```env
TONAPI_KEY=
ETHERSCAN_API_KEY=
RPC_URL=
TON_WALLETS=
EVM_WALLETS=
APTOS_WALLETS=
MAIN_WALLET=
SCAN_INTERVAL_MS=300000
```

## Health Check

Use:

```txt
/health
```

Expected result:

```json
{"ok":true}
```

## Safety Defaults

Production should start with:

```env
DRY_RUN=true
ENABLE_WRITE_ACTIONS=false
```

Only enable write actions after explicit code-level guards, logs and dry-run verification.
