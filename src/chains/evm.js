import { ethers } from 'ethers';

export async function getEvmNativeBalance({ address, rpcUrl }) {
  if (!address) {
    throw new Error('Missing EVM address');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl || 'https://ethereum.publicnode.com');
  const balance = await provider.getBalance(address);

  return {
    chain: 'EVM',
    address,
    balance: ethers.formatEther(balance),
    symbol: 'ETH'
  };
}
