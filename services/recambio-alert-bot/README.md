# RecambioAlertBot

Servicio 24/7 para vigilar referencias OEM (Toyota/Lexus) y avisar por Telegram.
Fuente principal: eBay (Playwright). Fuente secundaria: Autodoc (best-effort).

## Variables de entorno (Railway)
- BOT_TOKEN (requerida)
- CHAT_ID (requerida)
- INTERVAL_MINUTES (default 30)
- DROP_EUR (default 5)
- MAX_RESULTS (default 15)
- HEADLESS (default true)
- LOG_LEVEL (default info)
- USER_AGENT (default realista)
- PROXY_URL (opcional)
- EBAY_DOMAIN (default ebay.es)
- STRICT_OEM (default true)
- PORT (opcional; expone /health y /ready si existe)

## Local
cd services/recambio-alert-bot
npm install
$env:BOT_TOKEN="..."
$env:CHAT_ID="..."
npm start

## Railway
- Root directory: services/recambio-alert-bot
- Detecta Dockerfile
- Añade variables y deploy
