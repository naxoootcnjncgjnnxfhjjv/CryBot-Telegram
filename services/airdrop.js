import { ethers } from 'ethers';

// ABI fragmentos para funciones posibles
const ABI_CLAIM_FUNCTIONS = [
  "function claim() external",
  "function claim(address) external",
  "function harvest() external",
  "function getReward() external",
  "function withdraw() external",           // algunos contratos usan withdraw() para claim (sin parámetros)
  "function withdraw(uint256) external",    // pool de staking donde withdraw(cantidad) retira y a veces también reclama
  "function exit() external"
];
// ABI fragmentos para leer posibles acumulaciones
const ABI_VIEW_FUNCTIONS = [
  "function claimable(address) view returns (uint256)",
  "function earned(address) view returns (uint256)",   // algunos staking usan earned()
  "function pendingReward(address) view returns (uint256)",
  "function pendingRewards(address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)" // en algunos casos, tokens acumulados se reflejan como balance en el contrato de recompensa
];

export async function claimRewards(wallet, contractAddress) {
  const contract = new ethers.Contract(contractAddress, [...ABI_CLAIM_FUNCTIONS, ...ABI_VIEW_FUNCTIONS], wallet);

  // Primero, chequear si hay algo que reclamar para evitar tx inútil
  const userAddr = wallet.address;
  let claimable = null;
  for (const func of ["claimable", "earned", "pendingReward", "pendingRewards"]) {
    if (contract[func] !== undefined) {
      try {
        const pending = await contract[func](userAddr);
        if (pending && pending.toString && ethers.toBigInt(pending) > 0n) {
          claimable = ethers.toBigInt(pending);
          break;
        }
      } catch {}
    }
  }
  // Algunos contratos acumulan recompensas como "balanceOf"
  if (claimable === null && contract["balanceOf"] !== undefined) {
    try {
      const bal = await contract.balanceOf(userAddr);
      if (bal && ethers.toBigInt(bal) > 0n) {
        claimable = ethers.toBigInt(bal);
      }
    } catch {}
  }
  if (claimable !== null && claimable === 0n) {
    // Hay función pero retorna 0 (no hay nada)
    return null;
  }
  // Si ninguna función de lectura indicó nada, de todas formas podríamos intentar claim (puede ser que no exista una view)
  // Proceder a intentar cada función de claim hasta dar con la correcta
  const claimFuncs = ["claim(address)", "claim()", "harvest()", "getReward()", "withdraw()", "withdraw(uint256)", "exit()"];
  for (const sig of claimFuncs) {
    if (contract[sig.split('(')[0]] !== undefined) {  // comprobar existencia
      try {
        let tx;
        if (sig === "claim(address)") {
          tx = await contract["claim"](userAddr);
        } else if (sig === "withdraw(uint256)") {
          // withdraw(uint256): normalmente requiere cantidad staked; aquí pasamos 0 para solo claim, si acepta 0.
          tx = await contract["withdraw"](0);
        } else {
          // claim(), harvest(), getReward(), withdraw(), exit() sin params
          tx = await contract[sig.split('(')[0]]();
        }
        await tx.wait();
        return tx;
      } catch (err) {
        // Si la llamada no es válida (p.ej. función inexistente lanza error, o revert), probamos la siguiente
        if (err.message && err.message.includes("function")) {
          continue;
        } else {
          // Si es un error diferente (revert con mensaje), lo lanzamos hacia arriba
          throw err;
        }
      }
    }
  }
  // Si llegó aquí, ninguna función encajó o todas fallaron
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