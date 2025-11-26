const { beginCell, Address, Cell } = require('@ton/core');
const { TonClient4, WalletContractV4, mnemonicToWalletKey } = require('@ton/ton');
const fetch = require('node-fetch');

/**
 * Build the body for an NFT `transfer` call in accordance with the TON NFT
 * standard. The resulting cell can be used as the body of an internal message
 * to the NFT contract. See https://github.com/ton-blockchain/nft-standard for
 * details.
 *
 * @param {Object} params Transfer parameters
 * @param {string} params.nftAddress Address of the NFT contract
 * @param {string} params.offerAddress Address of the marketplace offer contract
 * @param {string} params.responseAddress Address which will receive the sale proceeds
 * @param {bigint} params.forwardAmount Amount of TON to forward in nanoTON
 * @param {bigint} [params.queryId] Unique identifier for the transfer
 * @param {Cell} [params.payload] Optional payload to attach to the transfer
 * @returns {Cell} The encoded transfer body
 */
function buildNftTransferBody(params) {
  const queryId = params.queryId ?? BigInt(Date.now());
  const offerAddr = Address.parseRaw(params.offerAddress);
  const responseAddr = Address.parseRaw(params.responseAddress);
  const payload = params.payload;
  const body = beginCell()
    // transfer opcode (0x5fcc3d14) per standard
    .storeUint(0x5fcc3d14, 32)
    // query id
    .storeUint(queryId, 64)
    // new owner address (offer contract)
    .storeAddress(offerAddr)
    // response address (seller)
    .storeAddress(responseAddr)
    // custom payload: either present or null
    .storeMaybeRef(payload ?? null)
    // amount of TON to forward along with the NFT (price + 0) in nanoTON
    .storeCoins(params.forwardAmount)
    .endCell();
  return body;
}

/**
 * Emulate sending a message to the blockchain without executing it.  This
 * function uses TonAPI's emulation endpoint to predict the outcome of the
 * transaction, including exit codes and fees.  If the TONAPI key is not
 * present or the endpoint fails, an error will be thrown.
 *
 * @param {string} from Address of the sender wallet (raw form)
 * @param {string} to Address of the NFT contract (raw form)
 * @param {Cell} body Serialized message body
 * @returns {Promise<any>} JSON result of the emulation
 */
async function emulateTransfer(from, to, body) {
  const tonApiKey = process.env.TONAPI_KEY;
  if (!tonApiKey) {
    throw new Error('Emulation requires TONAPI_KEY');
  }
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${tonApiKey}`,
  };
  // Encode message cell as BOC base64
  const boc = body.toBoc().toString('base64');
  const payload = {
    messages: [
      {
        address: from,
        body: boc,
        state_init: null,
      },
    ],
  };
  const res = await fetch('https://tonapi.io/v2/emulate/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Emulation failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Send an NFT transfer message to the blockchain using the provided mnemonic.
 * If the `dryRun` flag is set the message is emulated and no transaction is
 * sent.  Returns the transaction hash or emulation result.
 *
 * @param {Object} params Accept parameters
 * @param {string} params.nftAddress Address of the NFT contract
 * @param {string} params.offerAddress Address of the marketplace offer contract
 * @param {string} params.responseAddress Address to receive sale proceeds
 * @param {bigint} params.forwardAmount Amount of TON to forward in nanoTON
 * @param {bigint} [params.queryId] Optional query id
 * @param {Cell} [params.payload] Optional payload
 * @param {boolean} [dryRun=false] If true perform emulation only
 * @returns {Promise<{hash?: string, emulation?: any}>}
 */
async function acceptNftOffer(params, dryRun = false) {
  const mnemonic = process.env.TON_MNEMONIC;
  const rpcEndpoint = process.env.TON_RPC || 'https://toncenter.com/api/v2/jsonRPC';
  if (!mnemonic) {
    throw new Error('TON_MNEMONIC must be set to accept offers');
  }
  // Derive wallet key from mnemonic
  const keyPair = await mnemonicToWalletKey(mnemonic.split(' '));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const client = new TonClient4({ endpoint: rpcEndpoint });
  const seqno = await client.getSeqno(wallet.address);
  const transferBody = buildNftTransferBody(params);
  if (dryRun) {
    const emu = await emulateTransfer(wallet.address.toString({ raw: true }), params.nftAddress, transferBody);
    return { emulation: emu };
  }
  // Build and send message.  The wallet will sign the message automatically.
  const message = await wallet.createTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    messages: [
      {
        to: Address.parseRaw(params.nftAddress),
        value: params.forwardAmount,
        body: transferBody,
      },
    ],
  });
  const sendRes = await client.sendExternalMessage(wallet, message);
  return { hash: sendRes };
}

module.exports = {
  buildNftTransferBody,
  emulateTransfer,
  acceptNftOffer,
};