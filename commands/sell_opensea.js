import { Seaport } from "@opensea/seaport-js";
import axios from 'axios';
import { ethers } from 'ethers';

export async function marketplaceOpenSea(wallet, collection, tokenId, price, currency = 'ETH', type = 'ERC721', quantity = 1, durationDays = 1) {
  const accountAddress = wallet.address;
  const provider = wallet.provider;
  const seaport = new Seaport(wallet);  // usando signer directamente

  // Aprobación de NFT al conduit de Seaport (si no está aprobado)
  // Seaport usa por defecto ConduitKey=0x0 (conduit central) => contrato de transferencia Seaport
  // Dirección zero se utiliza como zone por defecto (OpenSea no usa zone restrictiva para listados básicos)
  let nftContract = new ethers.Contract(collection, [
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "function setApprovalForAll(address operator, bool approved) external",
    // También soportar ERC721 approve (para single token) si no es 1155:
    "function getApproved(uint256 tokenId) view returns (address)",
    "function approve(address to, uint256 tokenId) external"
  ], wallet);
  const seaportConduit = "0x0000000000000000000000000000000000000000"; // Conduit zero address implies direct Seaport contract
  // Verificar si ya está aprobado
  let approved = false;
  if (type === 'ERC1155') {
    approved = await nftContract.isApprovedForAll(accountAddress, seaportConduit);
    if (!approved) {
      const tx = await nftContract.setApprovalForAll(seaportConduit, true);
      await tx.wait();
    }
  } else {
    // ERC721: podemos usar isApprovedForAll también, o check de getApproved para ese token específico
    const operatorApproved = await nftContract.isApprovedForAll(accountAddress, seaportConduit);
    let tokenApprovedTo = null;
    if (!operatorApproved) {
      tokenApprovedTo = await nftContract.getApproved(tokenId).catch(() => null);
    }
    if (!operatorApproved && tokenApprovedTo !== seaportConduit) {
      // Aprobar token específico (o como mejor práctica, approveAll)
      try {
        const tx = await nftContract.approve(seaportConduit, tokenId);
        await tx.wait();
      } catch (err) {
        // Si falla approve individual (algunos NFT no soportan getApproved?), intentar setApprovalForAll
        const tx2 = await nftContract.setApprovalForAll(seaportConduit, true);
        await tx2.wait();
      }
    }
  }

  // Calcular tiempo de inicio y fin de la orden
  const now = Math.floor(Date.now() / 1000);
  const startTime = now;
  const endTime = now + durationDays * 24 * 60 * 60;
  // Determinar itemType según tipo de token
  const offerItemType = (type === 'ERC1155') ? 3 : 2;  // 2 = ERC721, 3 = ERC1155 en Seaport [oai_citation:7‡github.com](https://github.com/ProjectOpenSea/seaport-js/issues/288#:~:text=%7B%20itemType%3A%202%2C%20token%3A%20,)
  // Determinar consideración (lo que recibimos)
  const amountWei = ethers.parseEther(String(price));
  // Consideration: una entrada que es el pago al vendedor (nosotros)
  const consideration = [{
    amount: amountWei.toString(),
    recipient: accountAddress,
    token: (currency === 'ETH') ? ethers.ZeroAddress : "0xC02aaa39b223FE8D0A0e5C4F27ead9083C756Cc2", // WETH token address
    // itemType: 0 = ETH, 1 = ERC20
    itemType: (currency === 'ETH') ? 0 : 1,
    identifier: "0"  // not used for ETH/ERC20
  }];
  // Offer: el NFT que ofrecemos
  const offer = [{
    itemType: offerItemType,
    token: collection,
    identifier: tokenId,
    startAmount: (type === 'ERC1155') ? String(quantity) : "1",
    endAmount: (type === 'ERC1155') ? String(quantity) : "1"
  }];

  const orderParameters = {
    offerer: accountAddress,
    zone: ethers.ZeroAddress,  // sin zona
    offer,
    consideration,
    startTime: String(startTime),
    endTime: String(endTime),
    orderType: 0,  // FULL_OPEN order
    zoneHash: '0x' + '00'.repeat(32),
    salt: ethers.hexlify(ethers.randomBytes(16)),  // aleatorio
    conduitKey: '0x' + '00'.repeat(32),  // usar Seaport central sin conduit (0 hash)
    totalOriginalConsiderationItems: consideration.length
  };

  // Crear orden Seaport (firma)
  const createOrderInput = {
    parameters: orderParameters,
    // Seaport v2 pide supply cualquier offers? para partial? Nosotros usamos full order, no partial fills
    // signature se obtiene tras executeAllActions
  };
  const { executeAllActions } = await seaport.createOrder(createOrderInput);
  const order = await executeAllActions();

  // En este punto tenemos la orden firmada (`order`) con su `order.parameters` y `order.signature`.
  // Registrar la orden en OpenSea a través de la API (requiere API key)
  let success = false;
  let message = '';
  if (process.env.OPENSEA_API_KEY) {
    try {
      const resp = await axios.post(
        'https://api.opensea.io/v2/orders/ethereum/seaport/listings',
        { order },  // enviar la orden completa
        { headers: { 'Content-Type': 'application/json', 'X-Api-Key': process.env.OPENSEA_API_KEY } }
      );
      success = true;
      const orderHash = order?.parameters?.salt || '(hash no disponible)';
      message = `Orden Seaport creada (hash: ${orderHash}). Listada en OpenSea.`;
    } catch (apiErr) {
      console.error('Error OpenSea API:', apiErr.response?.data || apiErr.message);
      message = 'No se pudo registrar via API en OpenSea. Verificar API Key y permisos.';
      // Podemos permitir success=true aunque la API falle, porque la orden firmada existe.
      // Si la orden no se publicó, quizás OpenSea la detecte si se llama "validate" on-chain (no implementado aquí).
    }
  } else {
    // Si no hay API Key, devolvemos la URL manual para que el usuario la verifique
    const assetUrl = `https://opensea.io/assets/ethereum/${collection}/${tokenId}`;
    message = `Orden creada offline. Por favor verificar en OpenSea: ${assetUrl}`;
    success = true;
  }
  return { success, message };
}