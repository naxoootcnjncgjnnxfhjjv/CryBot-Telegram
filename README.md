# CryBot-Telegram

CryBot Telegram es un bot de Telegram que monitoriza los balances de varias
wallets en redes EVM (Ethereum y compatibles) y TON, permite reclamar airdrops y
enviar ETH a través de comandos de administrador. Se ejecuta con Node.js y usa
`telegraf`, `ethers`, `axios` y `node-cron`.

> **Nota sobre seguridad**: el bot necesita claves sensibles (token de Telegram,  
> clave privada de tu wallet, claves de API, etc.) para funcionar. Esas claves **nunca deben almacenarse en el código ni subirse al repositorio**. Utiliza variables de entorno configuradas en Railway u otro gestor de secretos y asegúrete de que el archivo `.env` está excluido por `.gitignore`.

## Requisitos

- Node.js ≥ 18
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

3. Configura las variables de entorno.  
   - En entornos como Railway puedes definir todas las claves (BOT_TOKEN, PRIVATE_KEY, etc.) desde la interfaz de configuración de variables y no necesitarás un `.env`.  
   - Para desarrollo local, copia el archivo de ejemplo y rellena los valores:

   ```bash
   cp .env.example .env
   # edita .env y rellena los valores requeridos
   ```

   Variables importantes:

   - `BOT_TOKEN`: token del bot de Telegram.
   - `ADMIN_TELEGRAM_ID`: ID de Telegram del administrador (solo quien puede ejecutar comandos sensibles).
   - `PRIVATE_KEY`: clave privada de la wallet EVM principal (habilita envíos de ETH y reclamos).
   - `ETHERSCAN_API_KEY`: clave de Etherscan (opcional).
   - `TON_API_KEY`: clave para TonAPI (opcional).
   - `RPC_URL`: URL de un nodo RPC público o privado (por defecto se usa `https://ethereum.publicnode.com`).
   - `MAIN_WALLET`: dirección de tu wallet principal.
   - `NETWORK`: red EVM (por defecto `mainnet`).

4. Ejecuta el bot:

   ```bash
   node improved_index.js
   ```

## Uso

Cuando el bot esté en marcha, podrás interactuar con él en Telegram:

- `/help`: muestra ayuda y comandos disponibles.
- `/ping`: comprueba si el bot está activo.
- `/balance [address]`: muestra el balance de una dirección EVM (por defecto la del bot).
- `/destino`: muestra la dirección destino configurada.
- `/vender ...`: crea una orden de venta de NFT (solo admin).
- `/confirmar <código>`: confirma una venta pendiente.
- `/claim <contrato>`: reclama recompensas de un contrato (solo admin).
- `/claimall [contratos...]`: reclama recompensas de varios contratos (solo admin).

El bot también puede ejecutar tareas periódicas: escaneo automático de balances y reporte diario, o "harvest" automático de contratos configurados.

## Estructura del proyecto

- `improved_index.js`: archivo principal que inicia el bot y define comandos avanzados.
- `config.js`: carga y valida las variables de entorno.
- `.env.example`: plantilla de configuración.
- `.gitignore`: archivos y carpetas excluidos del control de versiones.

## Seguridad

- **Nunca compartas tu archivo `.env` ni tus claves privadas**.
- Asegúrete de que `.env` está en `.gitignore` para que no se suba al repositorio.
- Revoca cualquier clave de API o token que se filtre.
- Usa wallets de prueba para experimentar antes de ejecutar en red principal.

## Contribuir

Las contribuciones son bienvenidas. Puedes abrir issues o PRs con mejoras,
reportes de bugs o nuevas funcionalidades. Se recomienda seguir las convenciones
de codificación definidas en `.github/copilot-instructions.md` para sacar el máximo provecho del asistente de GitHub.
