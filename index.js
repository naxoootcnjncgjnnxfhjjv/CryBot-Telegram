{
  "name": "crybot-listing",
  "version": "1.0.0",
  "description": "CryBot module for listing Planet IX NFTs on OpenSea (Polygon)",
  "main": "prepare_and_send_listing.js",
  "type": "commonjs",
  "scripts": {
    "start": "node prepare_and_send_listing.js"
  },
  "dependencies": {
    "@opensea/seaport-js": "^1.7.2",
    "axios": "^1.7.5",
    "dotenv": "^16.4.5",
    "ethers": "^6.11.1"
  },
  "author": "CryBot System",
  "license": "MIT"
}