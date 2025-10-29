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

export async function claimRewards(wallet, contractAddress) {
  const contract = new ethers.Contract(
    contractAddress,
    [...ABI_CLAIM_FUNCTIONS, ...ABI_VIEW_FUNCTIONS],
    wallet
  );
  const userAddr = wallet.address;
  let claimable = null;

  // 1. Leer recompensas pendientes con funciones comunes
  for (const fn of ['claimable', 'earned', 'pendingReward', 'pendingRewards']) {
    if (typeof contract[fn] === 'function') {
      try {
        const pending = await contract[fn](userAddr);
        if (pending && ethers.toBigInt(pending) > 0n) {
          claimable = ethers.toBigInt(pending);
          break;
        }
      } catch {
        // Ignorar errores y probar la siguiente función
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

  // Si claimable es 0, no hay nada que reclamar
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
          // Pasar la dirección del usuario
          tx = await contract.claim(userAddr);
        } else if (sig === 'withdraw(uint256)') {
          // Algunos contratos usan withdraw(0) para reclamar sin retirar stake
          tx = await contract.withdraw(0);
        } else {
          tx = await contract[fnName]();
        }
        await tx.wait(); // Esperar a que la transacción sea minada
        return tx;
      } catch (err) {
        // Si falla por inexistencia o firma no válida, continuar con la siguiente firma
        if (err && err.message && err.message.includes('function')) {
          continue;
        }
        // Cualquier otro error se propaga para permitir su manejo externo
        throw err;
      }
    }
  }

  // Si ninguna función pudo ejecutarse, devolver null
  return null;
}

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