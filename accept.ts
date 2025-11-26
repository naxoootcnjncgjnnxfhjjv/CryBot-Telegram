import { beginCell, ContractProvider, storeMessage, address as toAddress, Address, Cell } from '@ton/core';
import { TonClient4, WalletContractV4, mnemonicToWalletKey } from '@ton/ton';
import fetch from 'node-fetch';

/**
 * Parameters required to accept an NFT offer.  This structure is passed
 * between the job and the acceptor and contains all data necessary to
 * construct the transfer message.
 */
export interface AcceptOfferParams {
  /** Address of the NFT contract */
  nftAddress: string;
  /** Address of the marketplace offer contract to which the NFT will be transferred */
  offerAddress: string;
  /** Address which will receive the sale proceeds; typically the seller */
  responseAddress: string;
  /** Amount of TON to forward to the offer contract (price + fees) in nanoTON */
  forwardAmount: bigint;
  /** Unique identifier used for the NFT transfer.  If zero a random value will be used */
  queryId?: bigint;
  /** Optional payload to attach to the transfer.  Most offers do not require one */
  payload?: Cell;
}

/**
 * Builds the body for an NFT `transfer` call in accordance with the NFT
 * standard on TON.  The resulting cell can be used as the body of an
 * internal message to the NFT contract.  See
 * https://github.com/ton-blockchain/nft-standard for details.
 *
 * @param params Transfer parameters
 */
export function buildNftTransferBody(params: AcceptOfferParams): Cell {
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
 * Emulates sending a message to the blockchain without actually executing
 * it.  This uses TonAPI's emulation endpoint to predict the outcome of
 * the transaction, including exit codes and fees.  Returns the emulation
 * result as a JSON object.  If the TONAPI key is not present or the
 * endpoint fails, an error will be thrown.
 *
 * See https://docs.tonconsole.com/tonapi/rest-api/emulation for docs.
 */
export async function emulateTransfer(from: string, to: string, body: Cell): Promise<any> {
  const tonApiKey = process.env.TONAPI_KEY;
  if (!tonApiKey) {
    throw new Error('Emulation requires TONAPI_KEY');
  }
  const headers: Record<string, string> = {
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
 * Sends an NFT transfer message to the blockchain using the provided
 * mnemonic.  If the `dryRun` flag is set the message is emulated and no
 * transaction is sent.  Returns the transaction hash or emulation result.
 *
 * @param params Accept parameters
 * @param dryRun If true perform emulation only
 */
export async function acceptNftOffer(params: AcceptOfferParams, dryRun: boolean = false): Promise<{ hash?: string; emulation?: any }> {
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
  // Build and send message.  The wallet will sign the message automatically
  const message = await wallet.createTransfer(
    {
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        {
          to: Address.parseRaw(params.nftAddress),
          value: params.forwardAmount,
          body: transferBody,
        },
      ],
    },
  );
  const sendRes = await client.sendExternalMessage(wallet, message);
  return { hash: sendRes as unknown as string };
}