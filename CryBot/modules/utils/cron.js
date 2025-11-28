import { autoSellNFT } from "../sell/autoSell.js";
import { scanWalletNFTs } from "../nfts/scan.js";

/**
 * Periodically scans a wallet for NFTs and lists those that meet sale criteria.
 *
 * This function is designed to be invoked by CryBot's scheduler or cron module.  
 * It queries the configured wallet, evaluates each NFT for sale based on value and offers,  
 * and calls the `autoSellNFT` helper to handle the actual listing on OpenSea.
 */
async function runAutoSell() {
  // Replace this address with the EVM wallet being managed for auto-selling.
  const walletAddress = "0x7B9Fc90C99b2ae4711BDEe31049c357999e79B09";

  // Retrieve the current NFTs held by the wallet.
  const nfts = await scanWalletNFTs(walletAddress);

  // Iterate over each NFT and list those meeting the sale criteria.
  for (const nft of nfts) {
    // Example criteria: sell if estimated value >= $5 or if there is an active offer.
    if (nft.valueUsd >= 5 || nft.hasOffer) {
      const sale = await autoSellNFT(nft);
      console.log("Venta ejecutada:", sale);
    }
  }
}

export default runAutoSell;
