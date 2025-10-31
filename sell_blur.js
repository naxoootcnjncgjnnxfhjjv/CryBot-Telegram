// sell_blur.js (ESM)
// Blur does not provide a direct API for listings, but it indexes
// Seaport (OpenSea) listings and those from other aggregators.
// To list on Blur, we create a Seaport order using our existing
// OpenSea listing helper, which will automatically show up on Blur.
// If Blur adds a native listing API in the future, this module can
// be extended accordingly.

import { listOnOpenSea } from './sell_opensea.js';

/**
 * List an NFT on Blur by creating a Seaport order. The parameters mirror
 * those of the OpenSea listing helper for consistency.
 *
 * @param {Object} params - Listing parameters
 * @param {string} params.rpcUrl - JSON-RPC endpoint for Ethereum
 * @param {string} params.privateKey - Private key of the seller
 * @param {string} params.apiKey - OpenSea API key (optional)
 * @param {string} params.collection - Contract address of the NFT collection
 * @param {string|number} params.tokenId - Token ID of the NFT
 * @param {'erc721'|'erc1155'} params.tokenType - Token type (ERC-721 or ERC-1155)
 * @param {number} [params.quantity=1] - Quantity for ERC-1155 tokens
 * @param {string} [params.currency='ETH'] - Sale currency (e.g. 'ETH' or 'WETH')
 * @param {string|number} params.price - Listing price in ETH
 * @param {number} [params.durationHours=24] - Duration of the listing in hours
 * @returns {Promise<Object>} Result of the OpenSea listing (also indexed by Blur)
 */
export async function listOnBlur({
  rpcUrl,
  privateKey,
  apiKey,
  collection,
  tokenId,
  tokenType,
  quantity = 1,
  currency = 'ETH',
  price,
  durationHours = 24,
}) {
  console.log(
    "Blur: creando listado a través de Seaport (OpenSea). Blur indexará la orden automáticamente."
  );
  return listOnOpenSea({
    rpcUrl,
    privateKey,
    apiKey,
    collection,
    tokenId,
    tokenType,
    quantity,
    currency,
    price,
    durationHours,
  });
}