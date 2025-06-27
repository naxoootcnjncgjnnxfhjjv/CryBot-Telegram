# CryBot-Telegram

Bot de Telegram que responde al comando `/start` y se puede desplegar en plataformas como Vercel o Railway mediante un webhook.

## Uso

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. (Opcional) Crea un archivo `.env` con tu `WEBHOOK_URL` público.
3. Inicia el bot localmente:
   ```bash
   npm start
   ```

Cuando esté en producción, define `WEBHOOK_URL` con la URL de tu despliegue para que el bot registre automáticamente el webhook en `/webhook`.

### Despliegue

- **Railway**: crea un nuevo proyecto de Node.js y añade la variable `WEBHOOK_URL` en el panel de variables.
- **Vercel**: despliega la aplicación como un servidor Node.js y asegúrate de definir `WEBHOOK_URL` con la URL pública.

El archivo `.env` está ignorado por Git mediante `.gitignore`.
