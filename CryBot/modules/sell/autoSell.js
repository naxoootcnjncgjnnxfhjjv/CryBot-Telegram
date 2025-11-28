import { OpenSeaSDK } from "opensea-js";
import { ethers } from "ethers";

// Private key for the EVM wallet is loaded from the environment.  
// CryBot reads this variable at runtime to sign transactions securely.
const WALLET_PRIVATE_KEY = process.env.PRIVATE_KEY_7B9F;

// RPC endpoint used to connect to the Ethereum network.  
// A default RPC is provided but can be overridden via the EVM_RPC variable.
const RPC = process.env.EVM_RPC || "https://eth.llamarpc.com";

// Configure a provider and wallet instance using ethers.js.  
// These objects will be reused for all NFT sales to minimize overhead.
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);

/**
 * Automatically lists an NFT for sale on OpenSea at a competitive price.
 *
 * @param {Object} nft - NFT metadata and pricing info from CryBot's scanner.
 * @param {string} nft.tokenId - The NFT's token ID on the contract.
 * @param {string} nft.contract - The NFT contract address.
 * @param {number} [nft.floorPrice] - The current floor price in ETH (if available).
 * @param {number} [nft.valueUsd] - The NFT's estimated value in USD.
 * @param {boolean} [nft.hasOffer] - Whether the NFT currently has an active offer.
 * @returns {Promise<{ok: boolean, hash?: string, priceEth?: string, error?: string}>}
 *   Result object containing success state, order hash on success, and error message on failure.
 */
export async function autoSellNFT(nft) {
  try {
    // Initialise the OpenSea SDK with the provider and API key.
    const seaport = new OpenSeaSDK(provider, {
      chain: "ethereum",
      apiKey: process.env.OPENSEA_API_KEY,
    });

    // Determine a fair listing price.  
    // If a floor price exists, undercut by 1%; otherwise default to ~0.005 ETH (~$5).
    const priceEth = nft.floorPrice
      ? (nft.floorPrice * 0.99).toFixed(4)
      : "0.005";

    // Create the listing on OpenSea.  
    // The expiration time is set to 24 hours from now.
    const listing = await seaport.createListing({
      asset: {
        tokenId: nft.tokenId,
        tokenAddress: nft.contract,
      },
      accountAddress: wallet.address,
      startAmount: priceEth,
      endAmount: priceEth,
      expirationTime: Math.floor(Date.now() / 1000) + 86400,
    });

    return {
      ok: true,
      hash: listing.orderHash,
      priceEth,
    };
  } catch (e) {
    // Capture and return any errors that occur during the listing process.
    return { ok: false, error: e.message };
  }
}
