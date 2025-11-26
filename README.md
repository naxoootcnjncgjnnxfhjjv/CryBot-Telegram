# CryBot-Telegram

CryBot Telegram es un bot de Telegram que monitoriza los balances de varias wallets en redes EVM (Ethereum y compatibles) y **TON**. Permite reclamar airdrops, listar y vender NFTs en diferentes marketplaces y, opcionalmente, **auto‑aceptar ofertas de NFTs en TON**. Se ejecuta con Node.js y usa `telegraf`, `express`, `ethers`, `axios` y `ws`.

> **Nota sobre seguridad**: el bot necesita claves sensibles (token de Telegram, clave privada de tu wallet, claves de API, etc.) para funcionar. Esas claves **nunca deben almacenarse en el código ni subirse al repositorio**. Utiliza variables de entorno configuradas en Railway u otro gestor de secretos y asegúrate de que el archivo `.env` está excluido por `.gitignore`.

## Requisitos

- Node.js ≥ 18  
- Cuenta de Telegram y token de bot (BotFather)  
- Claves API opcionales: Etherscan y TonAPI para ampliar funcionalidades

## Instalación

1. Clona el repositorio y entra en la carpeta:

    git clone https://github.com/tuusuario/CryBot-Telegram.git
    cd CryBot-Telegram

2. Instala las dependencias:

    npm install

3. Configura las variables de entorno.  
   - En entornos como Railway puedes definir todas las claves (BOT_TOKEN, PRIVATE_KEY, etc.) desde la interfaz de configuración de variables y no necesitarás un `.env`.  
   - Para desarrollo local, copia el archivo de ejemplo y rellena los valores:

    cp .env.example .env
    # edita .env y rellena los valores requeridos

   Variables importantes:

   - BOT_TOKEN: token del bot de Telegram.  
   - ADMIN_TELEGRAM_ID: ID de Telegram del administrador (solo quien puede ejecutar comandos sensibles).  
   - PRIVATE_KEY: clave privada de la wallet EVM principal (habilita envíos de ETH y reclamos).  
   - ETHERSCAN_API_KEY: clave de Etherscan (opcional).  
   - TON_API_KEY: clave para TonAPI (opcional).  
   - RPC_URL: URL de un nodo RPC público o privado (por defecto se usa https://ethereum.publicnode.com).  
   - MAIN_WALLET: dirección de tu wallet principal.  
   - NETWORK: red EVM (por defecto mainnet).  
   - AUTO_ACCEPT_ENABLED: establece a 1 para habilitar la auto‑aceptación de ofertas NFT en TON (0 por defecto).  
   - DRY_RUN: 1 para emular las aceptaciones sin enviar transacciones, 0 para ejecutarlas en cadena.  
   - AUTO_ACCEPT_MIN_TON: precio mínimo en TON para aceptar una oferta.  
   - AUTO_ACCEPT_WHITELIST: lista blanca de compradores permitidos (direcciones separadas por coma).  
   - AUTO_ACCEPT_BLACKLIST: lista negra de compradores rechazados (direcciones separadas por coma).  
   - OFFERS_POLL_INTERVAL: intervalo de sondeo en milisegundos si no se usa streaming (por defecto 30000).  
   - TONAPI_KEY: clave de TonAPI para streaming y emulación (opcional).  
   - TELEGRAM_ALERT_CHAT_ID: ID del chat donde se enviarán notificaciones de aceptaciones automáticas.

4. Ejecuta el bot:

    npm start

   Esto lanzará server-express.js, que expone el bot vía webhook (Express) y registra todos los comandos. Si prefieres la versión CLI sin Express centrada en Ethereum, puedes usar:

    node improved_index.js

## Uso

Cuando el bot esté en marcha, podrás interactuar con él en Telegram:

- /saldo: muestra los balances de tus wallets en TON y MATIC, y el número de NFTs encontrados.  
- /nfts: lista tus NFTs en TON.  
- /autoaccept on|off: habilita o deshabilita la auto‑aceptación de ofertas.  
- /autoaccept dryrun on|off: activa o desactiva el modo de emulación.  
- /autoaccept min <TON>: establece el precio mínimo para aceptar ofertas.  
- /autoaccept status: muestra la configuración actual.  
- /help: muestra ayuda y comandos disponibles.  
- /ping: comprueba si el bot está activo.  
- /balance [address]: muestra el balance de una dirección EVM (por defecto la del bot).  
- /destino: muestra la dirección destino configurada.  
- /vender ...: crea una orden de venta de NFT (sólo admin, versión improved_index).  
- /confirmar <código>: confirma una venta pendiente.  
- /claim <contrato>: reclama recompensas de un contrato (sólo admin).  
- /claimall [contratos...]: reclama recompensas de varios contratos (sólo admin).

El bot también puede ejecutar tareas periódicas como escaneo automático de balances, reporte diario, "harvest" automático de contratos configurados y aceptación automática de ofertas de NFTs en TON.

## Estructura del proyecto

- server-express.js: archivo principal que inicia el bot con Express, registra los comandos `/saldo`, `/nfts`, `/autoaccept`, integra los servicios `tonService` y `planetixService` y arranca el job de auto‑aceptación de ofertas.  
- commands/autoaccept.js: comando de Telegram para gestionar la auto‑aceptación (habilitar, deshabilitar, dry‑run, etc.).  
- src/ton/accept.js y src/ton/offers.js: utilidades para escuchar ofertas de NFTs en TON y aceptar ofertas cumpliendo criterios configurables.  
- src/jobs/offers-acceptor.js: tarea que escucha eventos de ofertas NFT en TON (vía streaming o polling) y delega en `accept.js`.  
- services/tonService.js y services/planetixService.js: funciones para consultar balances y NFTs en TON y Polygon/PlanetIX.  
- improved_index.js: versión alternativa del bot con comandos avanzados para Ethereum (ventas, claim, inline query).  
- config.js: carga y valida las variables de entorno.  
- .env.example: plantilla de configuración.  
- .gitignore: archivos y carpetas excluidos del control de versiones.

## Seguridad

- **Nunca compartas tu archivo .env ni tus claves privadas**.  
- Asegúrate de que `.env` está en `.gitignore` para que no se suba al repositorio.  
- Revoca cualquier clave de API o token que se filtre.  
- Usa wallets de prueba para experimentar antes de ejecutar en red principal.

## Contribuir

Las contribuciones son bienvenidas. Puedes abrir issues o PRs con mejoras, reportes de bugs o nuevas funcionalidades. Se recomienda seguir las convenciones de codificación definidas en `.github/copilot-instructions.md` para sacar el máximo provecho del asistente de GitHub.