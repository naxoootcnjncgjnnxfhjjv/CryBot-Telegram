# CryBot Cleanup Audit

## Production Runtime

Keep:

```txt
src/index.js
src/core/
src/bot/
src/chains/
src/services/
src/workers/
.github/workflows/ci.yml
package.json
README.md
DEPLOYMENT.md
ARCHITECTURE.md
.env.example
CLEANUP_AUDIT.md
```

## Reviewed Classification

### Keep Production

```txt
package.json
README.md
DEPLOYMENT.md
ARCHITECTURE.md
CLEANUP_AUDIT.md
.env.example
.github/workflows/ci.yml
src/
```

### Keep As Legacy Reference

Do not use as production entrypoints:

```txt
server-express.js
config.js
improved_index.js
commands/
services/ legacy root folder if present
utils/ legacy root folder if present
```

Reason: these may still contain useful Telegram, marketplace, NFT, claim, farming or chain-specific logic that should be migrated before deletion.

### Do Not Delete Without Manual Extraction

```txt
wallet references
marketplace logic
NFT listing logic
airdrop/claim logic
TON/GetGems logic
PlanetIX logic
OpenSea/Blur/LooksRare logic
```

## Current Safe Runtime Commands

```bash
npm run start:safe
npm run scanner
npm run scanner:loop
npm run check
npm run validate
npm run audit
```

## Cleanup Policy

1. Search for secrets before deleting or moving files.
2. Preserve legacy references until their logic is migrated.
3. Do not delete wallet lists, API integration notes, marketplace logic, or chain-specific logic without extracting useful pieces.
4. Only delete obvious temporary files after inspection.
5. Keep production runtime small and based on `src/`.

## Known Resolved CI Issues

- TON peer dependency conflict fixed by using `@ton/core ^0.63.0`.
- GitHub Actions npm cache removed because no lockfile is present.
- CI runtime environment moved to job scope.

## Current Production Capabilities

- Telegram runtime starts from `src/index.js`.
- `/status` shows configured wallet counts.
- `/wallets` shows wallet counts.
- `/balances` reads TON, EVM and Aptos balances in read-only mode.
- Scanner worker can run once or loop.
- CI validates install, syntax, runtime, audit and scanner.

## Remaining Cleanup Work

- Review root legacy files in detail.
- Migrate useful marketplace/NFT/claim logic into `src/services` or `src/chains`.
- Remove legacy entrypoints only after migration.
- Add real persistence later.
