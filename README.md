# CryBot-Telegram

CryBot‑Telegram es un bot de Telegram que monitoriza los balances de varias wallets en redes EVM (Ethereum y compatibles) y TON, permite reclamar airdrops y enviar ETH a través de comandos de administrador. Se ejecuta con Node.js y usa `telegraf`, `ethers`, `axios` y `node-cron`.

## Requisitos

- Node.js ≥ 18
- Cuenta de Telegram y token de bot (BotFather)
- Claves API opcionales: Etherscan y TonAPI para ampliar funcionalidades

## Instalación

1. Clona el repositorio y entra en la carpeta:

   ```bash
   git clone https://github.com/tuusuario/CryBot-Telegram.git
   cd CryBot-Telegram
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Copia el archivo de ejemplo de variables de entorno y edítalo:

   ```bash
   cp .env.example .env
   # edita .env y rellena los valores requeridos
   ```

   Variables importantes:

   - `BOT_TOKEN`: token del bot de Telegram.
   - `ADMIN_TELEGRAM_ID`: ID de Telegram del administrador (solo quien puede ejecutar comandos sensibles).
   - `PRIVATE_KEY`: clave privada de la wallet EVM principal (habilita envíos de ETH y reclamos).
   - `ETHERSCAN_API_KEY`: clave de Etherscan (opcional, pero recomendada).
   - `TON_API_KEY`: clave para TonAPI (opcional).
   - `RPC_URL`: URL de un nodo RPC público o privado (por defecto se usa `https://ethereum.publicnode.com`).
   - `MAIN_WALLET`: dirección de tu wallet principal (recomendado).
   - `NETWORK`: red EVM (por defecto `mainnet`).
   - `DEFAULT_ETH`: dirección EVM usada por defecto si no se define otra en la configuración.

4. Ejecuta el bot:

   ```bash
   node index.js
   ```

## Uso

Cuando el bot esté en marcha, podrás interactuar con él en Telegram:

- `/help`: muestra ayuda y comandos disponibles.
- `/status`: test de vida simple.
- `/saldo`: muestra el balance de las wallets configuradas (EVM y TON).
- `/reclamar`: reclama airdrops (solo admin).
- `/enviar <dirección> <cantidad>`: envía ETH a una dirección EVM (solo admin).

El bot también realiza un escaneo automático cada 5 minutos y envía un reporte diario al administrador a las 09:00 (hora servidor), informando de los balances actuales.

## Estructura del proyecto

- `index.js`: archivo principal que inicia el bot y define comandos.
- `config.js`: carga y valida las variables de entorno y contiene direcciones y servicios por defecto.
- `.env.example`: plantilla de configuración.
- `.gitignore`: archivos y carpetas excluidos del control de versiones.

## Seguridad

- **Nunca compartas tu archivo `.env` ni tus claves privadas**.
- Revoca cualquier clave de API o token que se filtre.
- Usa wallets de prueba para experimentar antes de ejecutar en red principal.

## Contribuir

Las contribuciones son bienvenidas. Puedes abrir issues o PRs con mejoras, reportes de bugs o nuevas funcionalidades. Se recomienda seguir las convenciones de codificación definidas en `.github/copilot-instructions.md` para sacar el máximo provecho del asistente de GitHub.
