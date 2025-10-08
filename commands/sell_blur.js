import axios from 'axios';
import { ethers } from 'ethers';

export async function marketplaceBlur(wallet, collection, tokenId, price, currency = 'ETH', type = 'ERC721', quantity = 1, durationDays = 1) {
  // Blur utiliza su propio sistema (basado en Seaport pero con autenticación) [oai_citation:16‡docs.blur.foundation](https://docs.blur.foundation/contracts#:~:text=Contracts%20,0x000000000000ad05ccc4f10045630fb830b95127%20%3B%20Blur) [oai_citation:17‡docs.looksrare.org](https://docs.looksrare.org/blog/sell-nfts-with-zero-fees-on-looksrare#:~:text=marketplace%20and%20LooksRare%27s%20Seaport%20implementation,Starting%20today).
  // Para simplificar, requerimos integración con API de terceros (NFTGo) si se desea listar automáticamente.
  if (!process.env.NFTGO_API_KEY) {
    return { success: false, message: '❌ Para listar en Blur necesitas configurar NFTGO_API_KEY. ' +
      'Blur no permite listar vía contrato directamente sin autenticación.' };
  }
  const accountAddress = wallet.address;
  // Asegurar aprobación del NFT para Blur's exchange
  const blurExchangeAddress = "0x000000000000Ad05Ccc4F10045630fb830B95127"; // Blur Exchange Proxy [oai_citation:18‡docs.blur.foundation](https://docs.blur.foundation/contracts#:~:text=Contracts%20,0x000000000000ad05ccc4f10045630fb830b95127%20%3B%20Blur)
  const nftContract = new ethers.Contract(collection, [
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "function setApprovalForAll(address operator, bool approved) external"
  ], wallet);
  const approved = await nftContract.isApprovedForAll(accountAddress, blurExchangeAddress);
  if (!approved) {
    const tx = await nftContract.setApprovalForAll(blurExchangeAddress, true);
    await tx.wait();
  }
  try {
    // Pasos para listar en Blur vía NFTGo:
    // 1. Obtener reto de autenticación Blur
    const authChallengeResp = await axios.post(
      'https://data-api.nftgo.io/utils/v1/blur/get-auth-challenge',
      { wallet: accountAddress },
      { headers: { 'X-API-KEY': process.env.NFTGO_API_KEY } }
    );
    const challenge = authChallengeResp.data?.data?.message;
    if (!challenge) {
      throw new Error('No se obtuvo challenge de Blur');
    }
    // 2. Firmar el challenge con la wallet
    const signature = await wallet.signMessage(challenge);
    // 3. Enviar firma para obtener token de auth
    const authResp = await axios.post(
      'https://data-api.nftgo.io/utils/v1/blur/get-auth',
      { wallet: accountAddress, signature: signature },
      { headers: { 'X-API-KEY': process.env.NFTGO_API_KEY } }
    );
    const blurAuthToken = authResp.data?.data?.auth;
    if (!blurAuthToken) {
      throw new Error('No se obtuvo token de autenticación Blur');
    }
    // 4. Crear la orden/listing en Blur
    const priceWei = ethers.parseEther(String(price)).toString();
    const listingPayload = {
      authToken: blurAuthToken,
      order: {
        // Construir la orden Blur (similar a Seaport but simplified via API)
        "collection": collection,
        "tokenId": tokenId,
        "price": priceWei,
        "expirationTime": Math.floor(Date.now()/1000) + durationDays * 24 * 60 * 60,
        "paymentToken": (currency === 'ETH') ? ethers.ZeroAddress : "0xC02aaa39b223FE8D0A0e5C4F27ead9083C756Cc2"
      }
    };
    const createListResp = await axios.post(
      'https://data-api.nftgo.io/trading/v1/listings',
      listingPayload,
      { headers: { 'X-API-KEY': process.env.NFTGO_API_KEY } }
    );
    if (createListResp.data?.data?.orderId) {
      const orderId = createListResp.data.data.orderId;
      // 5. Publicar la orden creada
      await axios.post(
        'https://data-api.nftgo.io/trading/v1/post-order',
        { orderIds: [orderId] },
        { headers: { 'X-API-KEY': process.env.NFTGO_API_KEY } }
      );
      return { success: true, message: 'Listado en Blur creado exitosamente (Order ID: ' + orderId + ').' };
    } else {
      throw new Error(createListResp.data?.message || 'Error desconocido al crear listing en Blur');
    }
  } catch (err) {
    console.error('Error al listar en Blur:', err.response?.data || err.message);
    return { success: false, message: 'Error al listar en Blur: ' + (err.message || err) };
  }
}