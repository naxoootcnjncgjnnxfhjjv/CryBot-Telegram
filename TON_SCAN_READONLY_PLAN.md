# TON SCAN READ-ONLY PLAN

## GOAL
Build a safe, read-only TON scan layer that can:
- read wallet balances
- enumerate NFTs
- verify owner addresses
- classify wallet state (active / uninit)
- produce a report

## SAFETY RULES
- no private keys in repo
- no signing
- no transfers
- no auto-claim
- no auto-sell
- no state-changing transactions

## REQUIRED MODULES
1. ton-scan/balances.js
2. ton-scan/nfts.js
3. ton-scan/owners.js
4. ton-scan/classify.js
5. ton-scan/report.js

## MINIMUM OUTPUT PER WALLET
- wallet address
- state: active / uninit / nonexist
- TON balance
- NFT count
- NFT list with:
  - nft address
  - collection address
  - owner address
  - status: real / spam / review

## AUDIT PRINCIPLE
Only trust on-chain owner and wallet state. Do not infer ownership from assumptions, screenshots, or naming patterns.
