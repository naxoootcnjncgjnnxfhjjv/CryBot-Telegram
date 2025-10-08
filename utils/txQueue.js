let lastTxTime = 0;

export async function withTxDelay(func) {
  const now = Date.now();
  const delayNeeded = global.config?.minTxDelay || 10000;
  const sinceLast = now - lastTxTime;
  if (sinceLast < delayNeeded) {
    const wait = delayNeeded - sinceLast;
    console.log(`Esperando ${wait}ms antes de enviar la siguiente transacción...`);
    await new Promise(res => setTimeout(res, wait));
  }
  // Actualizar tiempo último tx
  lastTxTime = Date.now();
  // Ejecutar la función/transacción
  const result = await func();
  return result;
}