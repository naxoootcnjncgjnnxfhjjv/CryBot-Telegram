// Importar la clase Telegraf desde la librería telegraf
const { Telegraf } = require('telegraf');

// Obtener el token del bot desde la variable de entorno BOT_TOKEN
const botToken = process.env.BOT_TOKEN;
if (!botToken) {
    console.error('Error: la variable de entorno BOT_TOKEN no está definida');
    process.exit(1); // Terminar la ejecución si no hay token
}

// Inicializar el bot de Telegram con el token
const bot = new Telegraf(botToken);
// ===== Proteccion de destino segura =====

// Direccion principal y segura (Bitget)
const SAFE_DEST = '0x7B9Fc90C99b2ae4711BDEe31049c357999e79B09'.toLowerCase();

// Direcciones bloqueadas (ninguna por ahora)
const BLOCKED = new Set([]);

// Funcion para obtener el destino seguro
function pickWithdrawAddress() {
  if (!SAFE_DEST) throw new Error('WITHDRAW_TO vacio o no configurado');
  if (BLOCKED.has(SAFE_DEST)) throw new Error('Destino bloqueado por seguridad');
  return SAFE_DEST;
}

// Comando /destino
bot.command('destino', (ctx) => {
  ctx.reply(`Destino actual permitido:\n${pickWithdrawAddress()}`);
});

console.log('Proteccion activa ✅ Solo se usará la wallet principal Bitget.');
// Definir el comando /destino
bot.command('destino', (ctx) => {
    // Al recibir el comando /destino, responder con un mensaje de confirmación
    ctx.reply('Protección de destino segura activada');
});

// (Opcional) Definir el comando /start para mostrar un mensaje de bienvenida
bot.command('start', (ctx) => {
    ctx.reply('¡Hola! Soy CryBot. Usa /destino para activar la protección de destino.');
});
// Comando /ping para comprobar que el bot está activo
bot.command('ping', (ctx) => ctx.reply('pong ✅'));
// Capturar y manejar cualquier error que ocurra en las operaciones del bot
bot.catch((err, ctx) => {
    console.error(`Ocurrió un error en el bot: ${err}`);
    // Podemos agregar más manejo de errores aquí si es necesario
});

// Iniciar el bot (comenzar a sondear Telegram en busca de nuevos mensajes)
bot.launch()
    .then(() => {
        console.log('CryBot se ha iniciado correctamente.');
    })
    .catch((err) => {
        console.error('No se pudo iniciar CryBot:', err);
    });

// Habilitar la detención segura del bot en caso de que el proceso se termine
process.once('SIGINT', () => {
    console.log('Proceso interrumpido (SIGINT). Deteniendo CryBot...');
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    console.log('Proceso terminado (SIGTERM). Deteniendo CryBot...');
    bot.stop('SIGTERM');
});