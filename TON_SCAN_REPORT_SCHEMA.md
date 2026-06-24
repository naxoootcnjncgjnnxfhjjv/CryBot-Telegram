# TON SCAN REPORT SCHEMA

## PURPOSE
Define the exact output required from the read-only TON scan layer.

## TOP-LEVEL REPORT
```json
{
  "generated_at": "ISO8601",
  "wallets": [],
  "summary": {
    "wallet_count": 0,
    "active_count": 0,
    "uninit_count": 0,
    "nft_count": 0,
    "real_count": 0,
    "spam_count": 0,
    "review_count": 0
  }
}
```

## WALLET ENTRY
```json
{
  "wallet": "address",
  "state": "active|uninit|nonexist",
  "balance_ton": 0,
  "nfts": []
}
```

## NFT ENTRY
```json
{
  "nft_address": "address",
  "collection_address": "address|null",
  "owner_address": "address|null",
  "classification": "real|spam|review",
  "evidence": {
    "owner_verified": true,
    "wallet_state_verified": true,
    "history_checked": false
  }
}
```

## PRINCIPLE
If owner or state cannot be verified, classification must never be set to real.
