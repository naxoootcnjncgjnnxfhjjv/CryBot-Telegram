// ===== Protección de destino de fondos =====

// Dirección limpia y segura (única permitida)
const SAFE_DEST = (process.env.WITHDRAW_TO || '').toLowerCase();

// Lista de direcciones bloqueadas (no usar jamás)
const BLOCKED = new Set([
  '0x7b9fc90c99b2ae4711bdee31049c357999e79b09' // ⚠️ Bloqueada por política
]);

// Función para seleccionar destino seguro
function pickWithdrawAddress() {
  if (!SAFE_DEST) throw new Error('WITHDRAW_TO vacío o no configurado');
  if (BLOCKED.has(SAFE_DEST)) throw new Error('Destino bloqueado por seguridad');
  return SAFE_DEST;
}

// Comandos de control (Telegram)
bot.command('destino', (ctx) => {
  ctx.reply(`Destino actual permitido:\n${process.env.WITHDRAW_TO || '❌ No definido'}`);
});

bot.command('set_destino', (ctx) => {
  ctx.reply('Cambio de destino bloqueado en producción.\nEdita la variable WITHDRAW_TO en Railway si deseas modificarlo.');
});

console.log('Protección de destino activa ✅');