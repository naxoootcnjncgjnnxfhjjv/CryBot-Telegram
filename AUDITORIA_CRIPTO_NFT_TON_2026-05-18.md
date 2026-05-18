# Auditoría cripto / TON / NFT — 2026-05-18

## Objetivo

Consolidar lo detectado en Gmail, CSV de auditoría TON y GitHub para decidir qué repositorios y wallets sirven realmente para valoración/venta segura de NFTs y recuperación de saldos.

## Repositorios revisados

Se revisaron repositorios accesibles relacionados con CryBot, TON, NFTs, GetGems y wallets. El repositorio útil para trabajo operativo es:

- `naxoootcnjncgjnnxfhjjv/CryBot-Telegram`

Otros repositorios detectados parecen ser forks, pruebas, plantillas o repositorios auxiliares: `ton`, `ton-assets`, `TonDevWallet`, `TonDomainInfoBot`, `nftmetadata`, `crybotfinal`, `crybot-prod`, `BOT`, `telegram-crybot-v12`, entre otros.

## Hallazgos GitHub

### 1. Configuración de wallets existente

Archivo detectado:

- `CryBot2025/config/wallets.js`

Contiene wallets TON/EVM/Aptos/Solana históricas, pero falta actualizarlo con wallets críticas detectadas en la auditoría actual:

- `UQBCmTwGdlcNyan6lflRNnJr4xystiDOMoQdFJAMuSldzROn` — TON_BCM, saldo 6.064461589 TON, alto riesgo por `gift-claim.ton` / `IsScam=true`.
- `UQDXGQp2nDtUb985loKLV-AK8q0qyGK9D0vixyUUd4aWVvLE` — wallet con 24.860988 USDt TON + 0.117216798 TON.

### 2. Código moderno más seguro

La rama `Principal` usa estructura moderna en `src/`:

- `src/index.js`
- `src/core/config.js`
- `src/services/balanceScanner.js`
- `src/chains/ton.js`
- `src/workers/scanner.js`
- `src/services/walletInventory.js`

Puntos positivos:

- `DRY_RUN` por defecto es `true`.
- `ENABLE_WRITE_ACTIONS` por defecto es `false`.
- Scanner actual solo enumera wallets, no vende ni firma.

### 3. Código antiguo de venta automática GetGems

Se detectó:

- `sell_getgems.js`
- `services/auto-pricing.js`

Riesgo:

- `sell_getgems.js` usa `TON_WALLET_SEED` para firmar y listar NFTs.
- No debe ejecutarse hasta tener lista de venta validada, wallet limpia y control de riesgo.
- `services/auto-pricing.js` tiene lógica de undercut/floor, pero depende de reglas por colección y de un módulo de venta que puede firmar transacciones.

### 4. Archivo `.env`

Se detectó `.env` en el repositorio. Cualquier secreto que haya estado en GitHub debe considerarse expuesto y rotarse. No registrar claves privadas ni tokens reales en GitHub.

## Hallazgos Gmail / auditoría TON

### Wallets principales

1. `UQChtGxrxo1H74kGde0GNsSKWYG_rhGMKNco-opmWQ1B-yil`
   - Wallet central real.
   - Conexión: Wallet in Telegram, MoonPay, GoMining, dominio/NFTs.
   - Balance detectado: 1.55012285 TON.

2. `UQDXGQp2nDtUb985loKLV-AK8q0qyGK9D0vixyUUd4aWVvLE`
   - Valor líquido claro.
   - 24.860988 USDt TON + 0.117216798 TON.
   - Relación Bybit/Bitget detectada.

3. `UQBCmTwGdlcNyan6lflRNnJr4xystiDOMoQdFJAMuSldzROn`
   - 6.064461589 TON.
   - Nombre `gift-claim.ton`.
   - `IsScam=true`.
   - Solo tratar como recuperable si aparece dentro de una app oficial controlada por el usuario.

## NFTs detectados en CSV actual

- NFTs detectados: 131.
- Vender si hay oferta/floor: 68.
- Valorar manual: 9.
- Revisar: 16.
- Ignorar/riesgo: 38.

No hay 3.000 NFTs en los CSV subidos. Para detectar 3.000+ hay que escanear todas las wallets controladas.

## Regla de venta

No hacer:

- mint
- claim
- unlock
- gift
- airdrop
- connect wallet en enlaces dudosos
- firma desde `gift-claim.ton`

Sí hacer:

1. Confirmar control real de `TON_BCM` en Tonkeeper / Wallet in Telegram / MyTonWallet / Bybit.
2. Recuperar primero saldos líquidos: `UQDXG` y wallet central.
3. Valorar manualmente:
   - Telegram Usernames
   - TON DNS Domains
   - Getgems Domains
4. Para colecciones líquidas:
   - listar 3%–8% bajo floor real
   - aceptar oferta si es >= 90% del floor
5. Ignorar NFTs con `claim`, `gift`, `won`, `airdrop`, `locked`, `unlock`, `blacklist` o `IsScam=true`.

## Próximo desarrollo recomendado

Crear un scanner seguro en `src/` que:

- Lea `TON_WALLETS`.
- Consulte TonAPI `/v2/accounts/{wallet}/nfts`.
- Exporte CSV/JSON con colección, NFT, riesgo, wallet y enlaces Tonviewer/Getgems.
- No firme transacciones.
- No venda automáticamente.
- Solo proponga precio de venta por regla.

Después, separar un módulo de venta real protegido con:

- `ENABLE_WRITE_ACTIONS=true` obligatorio.
- `DRY_RUN=false` obligatorio.
- confirmación manual por Telegram.
- bloqueo absoluto de wallets/colecciones marcadas scam.

## Estado ejecutivo

- GitHub útil: `CryBot-Telegram`.
- Código actual más seguro: estructura `src/`.
- Código de venta antigua: no ejecutar sin auditoría.
- Valor líquido prioritario: `UQDXG` y wallet central.
- Wallet de mayor TON: `TON_BCM`, pero contaminada/scam; requiere confirmación de control real.
