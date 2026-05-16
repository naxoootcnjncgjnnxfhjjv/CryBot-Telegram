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
```

## Legacy Reference Files

Do not use as production entrypoints:

```txt
server-express.js
config.js
improved_index.js
commands/
services/ legacy root folder if present
utils/ legacy root folder if present
```

These files may contain useful migration logic. Do not delete until every useful function has been migrated into `src/`.

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

## Remaining Cleanup Work

- Review root legacy files.
- Migrate useful marketplace/NFT/claim logic into `src/services` or `src/chains`.
- Remove legacy entrypoints after migration.
- Add real persistence later.
