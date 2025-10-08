// sell_opensea.js (ESM)
import { ethers } from 'ethers';
import { Seaport } from '@opensea/seaport-js';

/**
 * Crea un listing fijo en OpenSea (Seaport) para ERC721/1155 con pago en ETH o WETH.
 * Requisitos:
 * - La wallet (PRIVATE_KEY) posee el NFT (y aprobación a Seaport si hace falta).
 */
export async function listOnOpenSea({
  rpcUrl,
  privateKey,
  apiKey,           // opcional
  collection,       // 0x...
  tokenId,          // string
  tokenType,        // 'erc721' | 'erc1155'
  quantity = 1,     // solo ERC1155
  currency = 'ETH', // 'ETH' | 'WETH' (marcado; Seaport/OS manejan el settlement)
  price,            // número
  durationHours = 24
}) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  // Instanciar Seaport con API key si la tienes
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

  // Precio en wei
  const amountWei = ethers.parseEther(String(price));

  // Consideration: cobras tú
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

  // Crear, firmar y publicar la orden
  const { executeAllActions } = await seaport.createOrder(params);
  const order = await executeAllActions();

  return {
    orderHash: order?.parameters?.salt ?? null,
    openSeaUrl: `https://opensea.io/assets/ethereum/${collection}/${tokenId}`,
    url: 'https://opensea.io/account'
  };
}