const { ethers } = require("ethers");
const axios = require("axios");

const MARKETPLACE = process.env.PLANETIX_MARKETPLACE_ADDRESS;
const COLLECTION = process.env.PLANETIX_COLLECTION_ADDRESS;
const ABI = JSON.parse(process.env.PLANETIX_ABI);

const provider = new ethers.JsonRpcProvider("https://polygon-rpc.com");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const marketplace = new ethers.Contract(MARKETPLACE, ABI, wallet);

// Main wallet where profits are sent
const MAIN_WALLET = "0x82219fc3B1d22f0DAd2703101724dfA8f08DC456";

module.exports = {
    // Scan for Planet IX NFTs owned by this wallet
    async scanPlanetIX() {
        console.log("[PlanetIX] Scanning NFTs…");
        const res = await axios.get(
            `https://api.polygonscan.com/api?module=account&action=tokennfttx&address=${wallet.address}`
        );
        const txs = res.data.result.filter(
            (tx) => tx.contractAddress.toLowerCase() === COLLECTION.toLowerCase()
        );
        // Return unique token IDs
        return [...new Set(txs.map((x) => x.tokenID))];
    },

    // Placeholder for retrieving current offer for a token
    async getOffer(tokenId) {
        // TODO: implement lookup of offers via Planet IX API or marketplace
        return null;
    },

    // Check all owned NFTs for offers above threshold and accept
    async checkOffers() {
        console.log("[PlanetIX] Checking offers…");
        const nfts = await this.scanPlanetIX();
        if (!nfts || nfts.length === 0) {
            console.log("[PlanetIX] No PlanetIX NFTs found for this wallet.");
            return;
        }
        for (const id of nfts) {
            const offer = await this.getOffer(id);
            if (offer && offer.price >= 5 * 1e18) {
                console.log(`[PlanetIX] Offer detected for token ${id}: ${offer.price} IXT`);
                await this.acceptOffer(offer.auctionId);
            }
        }
    },

    // Accept an offer by calling the marketplace contract
    async acceptOffer(auctionId) {
        console.log("[PlanetIX] Accepting offer…");
        const tx = await marketplace.buyNow(auctionId, {
            gasLimit: 450000
        });
        await tx.wait();
        console.log("[PlanetIX] Offer accepted:", tx.hash);
        await this.sendIXTToMainWallet();
    },

    // Transfer any IXT tokens in this wallet to the main wallet
    async sendIXTToMainWallet() {
        console.log("[PlanetIX] Sending IXT to main wallet…");
        const IXT = new ethers.Contract(
            "0xe06bd4f5aac8d0aa337d13ec88db6defc6eaeefe",
            [
                "function balanceOf(address) view returns (uint256)",
                "function transfer(address,uint256) returns (bool)"
            ],
            wallet
        );
        const bal = await IXT.balanceOf(wallet.address);
        if (bal > 0n) {
            await IXT.transfer(MAIN_WALLET, bal);
            console.log(`[PlanetIX] Sent ${bal} IXT to ${MAIN_WALLET}`);
        } else {
            console.log("[PlanetIX] No IXT balance to transfer.");
        }
    }
};
