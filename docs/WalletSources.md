# TON Wallet Contract Sources (Integrated into CryBot)

This document summarizes the wallet contract definitions used by CryBot. The contracts originate from the TONWeb project's `WalletSources.md` file. Each wallet version defines a smart‑contract code cell and initialization data used to deploy a TON wallet.

## Wallet versions

* **V1 wallet** – the original wallet contract defined by the TON team. It manages a single wallet address bound to a public key and contains simple functions for transferring funds. The contract is built from the `new‑wallet.fif` assembly code (available in the TON blockchain source). TonWeb converts this assembly into a bag‑of‑cells code cell and provides initialization data that includes the public key and wallet ID. When deploying a V1 wallet you must build the state init with the correct code and data to derive the expected address and ensure the wallet functions properly.

* **V2 and V3 wallets** – later versions of the wallet contract added features such as sub‑wallet IDs and improved replay protection. Each version has a different code cell and initialization data but is still bound to the owner's public key. When using these versions in CryBot you must ensure the correct version is loaded and that the wallet ID matches the expected value for each wallet instance.

* **V4 wallets** – the current standard, including revision 2 (v4‑r2) which is widely deployed. The compiled byte‑code of the v4‑r2 contract is published by TONWeb. According to TonSDK documentation, the wallet v4‑r2 code is provided as a bag‑of‑cells serialization in hexadecimal, and its SHA‑256 hash is `FEB5FF6820E2FF0D9483E7E0D62C817D846789FB4AE580C878866D959DABD5C0`. CryBot uses this version by default to generate wallets and sign transactions. When initializing a v4 wallet, CryBot must build the state init cell by pairing this code cell with a data cell that stores the owner's 256‑bit public key and a sub‑wallet ID (defaulting to 0). An incorrect pairing will produce a wrong address or cause the contract to reject messages.

## Security and initialization

* Always validate the code‑cell hash before deployment. The official v4‑r2 code cell hash is given above.
* The data cell must include the owner's public key and sub‑wallet ID; it should not include the private key.
* When computing the wallet address from the state init, make sure the chain ID (workchain) matches the network (e.g., `0` for mainnet).
* Keep private keys secure; CryBot signs transactions locally and never exposes the secret to the blockchain.

This document is intended as a reference for developers modifying CryBot's wallet routines. For full assembly listings and lower‑level details, refer to TONWeb's `WalletSources.md` in the `toncenter/tonweb` repository and the original FIF scripts.
