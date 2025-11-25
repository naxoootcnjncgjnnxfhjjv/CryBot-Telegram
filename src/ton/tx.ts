import { TonClient, WalletContractV4, internal, fromNano, toNano, Address } from 'ton';
import { mnemonicToPrivateKey } from 'ton-crypto';
import { getHttpEndpoint } from '@orbs-network/ton-access';

/**
 * Tipos
 */
export interface AcceptResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface AcceptArgs {
  collection: string;         // dirección del contrato colección
  tokenId: string;            // id del token a comprar
  from: string;               // dirección del comprador
  priceTon: number | string;  // precio en TON (se recomienda string p.ej. "0.2")
}

/**
 * Utilidades
 */
function toNanoSafe(v: number | string): bigint {
  // Evitar problemas de coma flotante convirtiendo SIEMPRE a string
  const s = typeof v === 'number' ? v.toString() : v;
  return toNano(s);
}

function assertAddress(addr: string, label: string): Address {
  try {
    // TON acepta direcciones base64url (EQ..., UQ...). parse valida el formato.
    return Address.parse(addr);
  } catch {
    throw new Error(`Dirección inválida para ${label}: ${addr}`);
  }
}

async function initClient(): Promise<TonClient> {
  const network = process.env.TON_NETWORK === 'testnet' ? 'testnet' : 'mainnet';
  const endpoint = await getHttpEndpoint({ network: network as 'mainnet' | 'testnet' });
  console.log(`🌐 Conectado al endpoint (${network}): ${endpoint}`);
  return new TonClient({ endpoint });
}

function getMnemonicFromEnv(): string[] {
  const raw = process.env.TON_MNEMONIC;
  if (!raw) throw new Error('❌ TON_MNEMONIC no está definido en las variables de entorno.');
  const words = raw.trim().split(/\s+/);
  if (words.length < 12) throw new Error('❌ TON_MNEMONIC debe contener al menos 12 palabras.');
  return words;
}

/**
 * Aceptar oferta de compra de un NFT/activo.
 * - Valida direcciones.
 * - Evita comparaciones con floats usando bigint.
 * - Mejora manejo de errores tipado como `unknown`.
 */
export async function acceptOffer(args: AcceptArgs): Promise<AcceptResult> {
  const { collection, tokenId, from, priceTon } = args;

  try {
    // Validación de entradas
    const toAddr = assertAddress(collection, 'collection');
    const fromAddr = assertAddress(from, 'from');
    if (!tokenId || !/^[0-9]+$/.test(tokenId)) {
      throw new Error(`tokenId inválido: ${tokenId}`);
    }

    // Cliente + wallet
    const client = await initClient();
    const mnemonic = getMnemonicFromEnv();
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const contract = client.open(wallet);

    // Saldos
    const balance = await contract.getBalance();
    console.log(`💰 Balance de la wallet: ${fromNano(balance)} TON`);

    // Cálculo seguro de precio + colchon de gas
    const price = toNanoSafe(priceTon);
    const gasBuffer = toNanoSafe(process.env.GAS_BUFFER_TON ?? '0.1');
    const needed = price + gasBuffer;

    if (balance < needed) {
      throw new Error(`Fondos insuficientes. Necesario: ${fromNano(needed)} TON, balance: ${fromNano(balance)} TON`);
    }

    // Construcción del mensaje interno
    const payload = internal({
      to: toAddr,
      value: price,
      // NOTA: idealmente usar celdas (beginCell) según el protocolo del marketplace;
      // dejamos el Buffer para mantener compatibilidad con la versión original.
      body: Buffer.from(`buy_token:${tokenId}:${fromAddr.toString()}`),
    });

    // Envío
    const seqno = await contract.getSeqno();
    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      messages: [payload],
      seqno,
      sendMode: 3,
    });

    console.log(`✅ Transacción enviada para el token #${tokenId} desde ${fromAddr.toString()}`);
    // La librería no devuelve hash directamente; exponemos el seqno como referencia.
    return { success: true, txHash: `seqno_${seqno}` };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`⚠️ Error al procesar la transacción: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Ejecución directa (node src/ton/tx.ts) para pruebas manuales
 * Requiere TON_MNEMONIC en el entorno.
 */
if (require.main === module) {
  (async () => {
    const result = await acceptOffer({
      collection: process.env.DEMO_COLLECTION ?? 'EQD123456789abcdef',
      tokenId: process.env.DEMO_TOKEN_ID ?? '42',
      from: process.env.DEMO_FROM ?? 'EQC987654321fedcba',
      priceTon: process.env.DEMO_PRICE_TON ?? '0.2',
    });
    console.log('Resultado:', result);
  })();
}
