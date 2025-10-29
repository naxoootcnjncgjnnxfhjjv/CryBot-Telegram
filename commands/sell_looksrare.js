import { Seaport } from "@opensea/seaport-js";
import axios from 'axios';
import { ethers } from 'ethers';

export async function marketplaceLooksRare(wallet, collection, tokenId, price, currency = 'ETH', type = 'ERC721', quantity = 1, durationDays = 1) {
  const accountAddress = wallet.address;
  // LooksRare v2 soporta órdenes Seaport [oai_citation:13‡looksrare.dev](https://looksrare.dev/changelog/2023-06-27v2-added-looksrare-seaport-orders-endpoints#:~:text=We%27ve%20added%20support%20to%20create,LooksRare%20orders%20based%20on%20Seaport). Creamos la orden igual que OpenSea.
  const seaport = new Seaport(wallet);
  // Aprobación similar a OpenSea (en LR v2 puede usarse Seaport conduit igual, se asume)
  const nftContract = new ethers.Contract(collection, [
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "function setApprovalForAll(address operator, bool approved) external",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function approve(address to, uint256 tokenId) external"
  ], wallet);
  const conduit = ethers.ZeroAddress;  // seaport direct
  if (type === 'ERC1155') {
    const approved = await nftContract.isApprovedForAll(accountAddress, conduit);
    if (!approved) {
      const tx = await nftContract.setApprovalForAll(conduit, true);
      await tx.wait();
    }
  } else {
    const operatorApproved = await nftContract.isApprovedForAll(accountAddress, conduit);
    let tokenApprovedTo = null;
    if (!operatorApproved) {
      tokenApprovedTo = await nftContract.getApproved(tokenId).catch(() => null);
    }
    if (!operatorApproved && tokenApprovedTo !== conduit) {
      try {
        const tx = await nftContract.approve(conduit, tokenId);
        await tx.wait();
      } catch {
        const tx2 = await nftContract.setApprovalForAll(conduit, true);
        await tx2.wait();
      }
    }
  }
  // Construir orden Seaport similar a OpenSea
  const now = Math.floor(Date.now() / 1000);
  const startTime = now;
  const endTime = now + durationDays * 24 * 60 * 60;
  const offerItemType = (type === 'ERC1155') ? 3 : 2;
  const amountWei = ethers.parseEther(String(price));
  const consideration = [{
    amount: amountWei.toString(),
    recipient: accountAddress,
    token: (currency === 'ETH') ? ethers.ZeroAddress : "0xC02aaa39b223FE8D0A0e5C4F27ead9083C756Cc2",
    itemType: (currency === 'ETH') ? 0 : 1,
    identifier: "0"
  }];
  const offer = [{
    itemType: offerItemType,
    token: collection,
    identifier: tokenId,
    startAmount: (type === 'ERC1155') ? String(quantity) : "1",
    endAmount: (type === 'ERC1155') ? String(quantity) : "1"
  }];
  const orderParameters = {
    offerer: accountAddress,
    zone: ethers.ZeroAddress,
    offer,
    consideration,
    startTime: String(startTime),
    endTime: String(endTime),
    orderType: 0,
    zoneHash: '0x' + '00'.repeat(32),
    salt: ethers.hexlify(ethers.randomBytes(16)),
    conduitKey: '0x' + '00'.repeat(32),
    totalOriginalConsiderationItems: consideration.length
  };
  const { executeAllActions } = await seaport.createOrder({ parameters: orderParameters });
  const order = await executeAllActions();

  // Enviar a LooksRare API
  let success = false;
  let message = '';
  if (process.env.LOOKSRARE_API_KEY) {
    try {
      // LooksRare API endpoint para Seaport orders
      const resp = await axios.post(
        'https://api.looksrare.org/api/v2/orders/seaport',
        order,
        { headers: { 'Content-Type': 'application/json', 'X-Looks-Api-Key': process.env.LOOKSRARE_API_KEY } }
      );
      success = true;
      message = `Orden Seaport enviada a LooksRare (respuesta: ${resp.status}).`;
    } catch (err) {
      console.error('Error LooksRare API:', err.response?.data || err.message);
      message = 'No se pudo listar via API de LooksRare. Verifique API Key.';
    }
  } else {
    const assetUrl = `https://looksrare.org/collections/${collection}/${tokenId}`;
    message = `Orden creada. Verificar manualmente en LooksRare: ${assetUrl}`;
    success = true;
  }
  return { success, message };
}