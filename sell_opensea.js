// sell_opensea.js (ESM) — Auto-approve a Seaport (OpenSea conduit)
import { ethers } from 'ethers';
import { Seaport } from '@opensea/seaport-js';

const OPENSEA_CONDUIT = '0x1E0049783F008A0085193E00003D00cd54003c71';

const ERC721_ABI = [
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)'
];
const ERC1155_ABI = [
  'function isApprovedForAll(address account, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)'
];

async function ensureOpenSeaApproval({ provider, signer, collection, tokenType }) {
  const owner = await signer.getAddress();
  const is1155 = tokenType === 'erc1155';
  const abi = is1155 ? ERC1155_ABI : ERC721_ABI;
  const contract = new ethers.Contract(collection, abi, provider);
  const already = await contract.isApprovedForAll(owner, OPENSEA_CONDUIT);
  if (already) return { approved: true, tx: null };
  const tx = await contract.connect(signer).setApprovalForAll(OPENSEA_CONDUIT, true);
  await tx.wait();
  return { approved: true, tx: tx.hash };
}

export async function listOnOpenSea({
  rpcUrl,
  privateKey,
  apiKey,
  collection,
  tokenId,
  tokenType,      // 'erc721' | 'erc1155'
  quantity = 1,   // solo ERC1155
  currency = 'ETH', // marcado (ETH/WETH); el settlement lo maneja Seaport
  price,
  durationHours = 24
}) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  // Auto-approve si falta
  const { tx } = await ensureOpenSeaApproval({ provider, signer, collection, tokenType });
  if (tx) console.log('Seaport approval tx:', tx);

  const seaport = new Seaport(signer, {
    overrides: apiKey ? { headers: { 'X-API-KEY': apiKey } } : undefined
  });

  const now = Math.floor(Date.now() / 1000);
  const endTime = now + Math.floor(durationHours * 3600);
  const ITEM_ERC721 = 2;
  const ITEM_ERC1155 = 3;

  const offer = [{
    itemType: tokenType === 'erc1155' ? ITEM_ERC1155 : ITEM_ERC721,
    token: collection,
    identifier: tokenId,
    amount: tokenType === 'erc1155' ? String(quantity) : undefined
  }];

  const amountWei = ethers.parseEther(String(price));
  const consideration = [{
    amount: amountWei.toString(),
    recipient: await signer.getAddress()
  }];

  const params = {
    offer,
    consideration,
    startTime: String(now),
    endTime: String(endTime),
    zone: ethers.ZeroAddress,
    zoneHash: '0x' + '00'.repeat(32)
  };

  const { executeAllActions } = await seaport.createOrder(params);
  const order = await executeAllActions();

  return {
    orderHash: order?.parameters?.salt ?? null,
    openSeaUrl: `https://opensea.io/assets/ethereum/${collection}/${tokenId}`,
    url: 'https://opensea.io/account'
  };
}