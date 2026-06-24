# SAFE READ-ONLY MODE

## PURPOSE
This mode is designed to inspect wallets, balances, NFTs and ownership data without creating on-chain risk.

## ALLOWED
- Read configured TON wallet balances
- Enumerate NFTs from public APIs
- Verify owner addresses
- Classify wallet state (active / uninit)
- Produce reports

## FORBIDDEN
- No private keys in code or repo
- No on-chain signing
- No auto-send
- No auto-sell
- No auto-claim
- No webhook-triggered fund movement

## REQUIRED RULES
- Use environment variables only for secrets
- Keep .env out of git
- Treat all scan flows as read-only until ownership is verified
- Separate infra code from asset-operation code

## CURRENT AUDIT CONCLUSION
The current repo contains reusable infrastructure, but the TON layer is incomplete and does not implement real NFT discovery or claim detection.
