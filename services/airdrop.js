import { ethers } from 'ethers';

// ABI para funciones de reclamación
const ABI_CLAIM_FUNCTIONS = [
  'function claim() external',
  'function claim(address) external',
  'function harvest() external',
  'function getReward() external',
  'function withdraw() external',
  'function withdraw(uint256) external',
  'function exit() external'
];

// ABI para funciones de lectura de recompensas pendientes
const ABI_VIEW_FUNCTIONS = [
  'function claimable(address) view returns (uint256)',
  'function earned(address) view returns (uint256)',
  'function pendingReward(address) view returns (uint256)',
  'function pendingRewards(address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

// Reclamación de recompensas para un contrato
export async function claimRewards(wallet, contractAddress) {
  const contract = new ethers.Contract(
    contractAddress,
    [...ABI_CLAIM_FUNCTIONS, ...ABI_VIEW_FUNCTIONS],
    wallet
  );
  const userAddr = wallet.address;
  let claimable = null;

  // 1. Intentar leer recompensas pendientes con funciones comunes
  for (const fn of ['claimable', 'earned', 'pendingReward', 'pendingRewards']) {
    if (typeof contract[fn] === 'function') {
      try {
        const pending = await contract[fn](userAddr);
        if (pending && pending.toString && ethers.toBigInt(pending) > 0n) {
          claimable = ethers.toBigInt(pending);
          break;
        }
      } catch {
        // Ignorar errores de lectura y probar la siguiente función
      }
    }
  }

  // 2. Algunos contratos reflejan las recompensas acumuladas en balanceOf()
  if (claimable === null && typeof contract.balanceOf === 'function') {
    try {
      const bal = await contract.balanceOf(userAddr);
      if (bal && ethers.toBigInt(bal) > 0n) {
        claimable = ethers.toBigInt(bal);
      }
    } catch {
      // Ignorar errores de balance
    }
  }

  // Si existe claimable pero es 0, no hay nada que reclamar
  if (claimable !== null && claimable === 0n) {
    return null;
  }

  // 3. Intentar cada posible función de reclamación en orden
  const claimFuncs = [
    'claim(address)',
    'claim()',
    'harvest()',
    'getReward()',
    'withdraw()',
    'withdraw(uint256)',
    'exit()'
  ];

  for (const sig of claimFuncs) {
    const fnName = sig.split('(')[0];
    if (typeof contract[fnName] === 'function') {
      try {
        let tx;
        if (sig === 'claim(address)') {
          // Pasar la address del usuario cuando la firma lo requiere
          tx = await contract.claim(userAddr);
        } else if (sig === 'withdraw(uint256)') {
          // Para withdraw(uint256) intentamos con 0 (solo claim sin retirar stake)
          tx = await contract.withdraw(0);
        } else {
          tx = await contract[fnName]();
        }
        await tx.wait(); // Esperar a que la transacción se minte
        return tx;
      } catch (err) {
        // Si el error indica “function ... not exists” o similar, continuamos con la siguiente firma
        if (err && err.message && err.message.includes('function')) {
          continue;
        }
        // Propagamos otros errores (por ejemplo, revert con mensaje)
        throw err;
      }
    }
  }

  // Si ninguna función se ejecutó correctamente, devolver null
  return null;
}

// Reclamación en lote para varios contratos
export async function claimAllRewards(wallet, contractAddresses) {
  const results = [];
  for (const addr of contractAddresses) {
    try {
      const tx = await claimRewards(wallet, addr);
      results.push({ contract: addr, tx });
    } catch (err) {
      results.push({ contract: addr, error: err });
    }
  }
  return results;
}