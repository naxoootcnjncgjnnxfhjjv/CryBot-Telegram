# Instrucciones para GitHub Copilot

Estas son las instrucciones para Copilot en este repositorio CryBot‑Telegram. El bot es un proyecto Node.js que usa las librerías Telegraf para Telegram, ethers para Ethereum, axios para peticiones HTTP y node‑cron para tareas programadas.

## Estructura

- `index.js`: archivo principal que inicia el bot y define los comandos de Telegram.
- `config.js`: carga y valida las variables de entorno y expone `loadConfig()` con los parámetros de configuración.
- `.env.example`: plantilla de variables de entorno requeridas.
- `.github/workflows`: flujos de CI.
- `package.json`: especifica dependencias y scripts.

## Pautas de codificación

- Usa indentación de 2 espacios.
- Utiliza punto y coma al final de cada sentencia.
- Emplea comillas simples (`'`) para strings.
- Evita funciones anónimas en objetos; usa funciones flecha cuando corresponda.
- Maneja errores con `try/catch` y mensajes descriptivos.
- No expongas ni hardcodes secretos; usa variables de entorno a través de `dotenv` y `config.js`.

## Buenas prácticas

- Descompón las tareas grandes en funciones pequeñas y reutilizables.
- Añade comentarios claros para explicar la intención del código.
- Crea pruebas y scripts de automatización cuando se añadan nuevas funcionalidades.
- Sigue las convenciones del repositorio a la hora de nombrar archivos y funciones.

## Guía para contribuir

Cuando abras un pull request, describe claramente los cambios realizados y los motivos. Asegúrate de que el bot se ejecute sin errores (`node index.js`) antes de enviar tu contribución.
