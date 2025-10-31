// sell_looksrare.js (ESM)
// LooksRare has a listing SDK and API, but integration requires additional
// dependencies and handling. As a pragmatic initial implementation,
// we reuse the OpenSea listing helper to create a Seaport order,
// which LooksRare indexes automatically thanks to aggregator support.
// If a native LooksRare listing function is desired, this module can
// be extended with the LooksRare SDK.

import { listOnOpenSea } from './sell_opensea.js';

/**
 * List an NFT on LooksRare. This function delegates to the OpenSea listing
 * helper, so that your NFT is listed via Seaport and then indexed by LooksRare.
 *
 * @param {Object} params - Listing parameters (see sell_opensea.js)
 * @returns {Promise<Object>} Result of the OpenSea listing
 */
export async function listOnLooksRare(params) {
  console.log(
    "LooksRare: creando listado a través de Seaport (OpenSea). LooksRare indexará la orden automáticamente."
  );
  // Forward to OpenSea listing helper
  return listOnOpenSea(params);
}