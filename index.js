// ===== Proteccion de destino segura =====

// Direccion limpia y unica permitida
const SAFE_DEST = (process.env.WITHDRAW_TO || '').toLowerCase();

// Lista de direcciones bloqueadas (no usar jamas)
const BLOCKED = new Set([
  '0x7b9fc90c99b2ae4711bdee31049c357999e79b09' // Bloqueada por seguridad
]);

// Funcion para seleccionar el destino seguro
function pickWithdrawAddress() {
  if (!SAFE_DEST) throw new Error('WITHDRAW_TO vacio o no configurado');
  if (BLOCKED.has(SAFE_DEST)) throw new Error('Destino bloqueado por seguridad');
  return SAFE_DEST;
}

// Comando para ver el destino actual
bot.command('destino', (ctx) => {
  ctx.reply(`Destino actual permitido:\n${process.env.WITHDRAW_TO || '❌ No definido'}`);
});

// Comando para cambiar destino (bloqueado en produccion)
bot.command('set_destino', (ctx) => {
  ctx.reply('Cambio de destino bloqueado en produccion. Edita la variable WITHDRAW_TO en Railway.');
});

// Mensaje de confirmacion en consola
console.log('Proteccion de destino activa ✅');

// Exportar funciones si se necesitan en otros modulos
module.exports = { pickWithdrawAddress, SAFE_DEST, BLOCKED };