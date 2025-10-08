import { ethers } from 'ethers';

// Topic hash de evento Transfer(address,address,uint256) - válido para ERC20 y ERC721 (ERC1155 usa otros eventos)
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
// Para ERC1155: TransferSingle y TransferBatch topics
const TRANSFER_SINGLE_TOPIC = "0xc3d58168c5aeeecfc83e1d46ad1d72dfc7c27f6d5d4acef5bf37f68e416ec854";
const TRANSFER_BATCH_TOPIC = "0x4a39dc06d4c0dbc64b70bfdadcb9442b4d7affc5a367d0d1d4b3fbd91437842c";

// Utilidad para formatear cantidades de tokens (simplificado)
function formatAmount(amount, decimals) {
  try {
    if (decimals != null) {
      return (Number(amount) / Math.pow(10, decimals)).toFixed(4);
    } else {
      // Si no hay decimales, devolvemos como entero
      return amount.toString();
    }
  } catch {
    return amount.toString();
  }
}

// Configurar un listener para eventos de la dirección dada
export function setupTracking(provider, bot, targetAddress, telegramUserId) {
  const addressLower = targetAddress.toLowerCase();
  // Suscripción a eventos de Transfer de ERC20/ERC721 donde targetAddress es destinatario o remitente
  provider.on({
    topics: [TRANSFER_TOPIC, null, ethers.id(addressLower)]
  }, (log) => {
    handleTransferLog(log, false);
  });
  // Suscripción a eventos ERC1155 TransferSingle
  provider.on({
    topics: [TRANSFER_SINGLE_TOPIC, null, ethers.id(addressLower)]
  }, (log) => {
    handleTransferLog(log, true);
  });
  // Suscripción a eventos ERC1155 TransferBatch
  provider.on({
    topics: [TRANSFER_BATCH_TOPIC, null, ethers.id(addressLower)]
  }, (log) => {
    handleTransferLog(log, true);
  });

  async function handleTransferLog(log, isERC1155) {
    try {
      const parsed = parseTransferLog(log, isERC1155);
      if (!parsed) return;
      const { type, from, to, tokenAddress, tokenId, amount, tokenSymbol, decimals } = parsed;
      // Solo nos interesa si la dirección monitorizada es receptor o emisor
      const toMe = to.toLowerCase() === addressLower;
      const fromMe = from.toLowerCase() === addressLower;
      if (!toMe && !fromMe) return;  // no nos involucra directamente (aunque el filtro debería evitarlo)
      let message;
      if (toMe && fromMe) {
        // Caso raro: de mi hacia mi (ej. mint a self), ignoramos
        return;
      } else if (toMe) {
        // Recepción
        if (type === 'ERC20') {
          message = `📥 Recibido *${formatAmount(amount, decimals)}* de *${tokenSymbol || 'tokens'}* (${tokenAddress}) desde ${from}`;
        } else if (type === 'ERC721') {
          message = `📥 Recibido NFT ERC721 \`${tokenAddress}\` *ID ${tokenId}* desde ${from}`;
        } else if (type === 'ERC1155') {
          message = `📥 Recibido NFT ERC1155 \`${tokenAddress}\` *ID ${tokenId}* x${amount} desde ${from}`;
        } else if (type === 'ETH') {
          message = `📥 Recibido *${formatAmount(amount, 18)} ETH* desde ${from}`;
        }
      } else if (fromMe) {
        // Envío (salida)
        if (type === 'ERC20') {
          message = `📤 Enviado *${formatAmount(amount, decimals)}* de *${tokenSymbol || 'tokens'}* (${tokenAddress}) a ${to}`;
        } else if (type === 'ERC721') {
          message = `📤 NFT ERC721 vendido/transferido \`${tokenAddress}\` *ID ${tokenId}* a ${to}`;
        } else if (type === 'ERC1155') {
          message = `📤 NFT ERC1155 transferido \`${tokenAddress}\` *ID ${tokenId}* x${amount} a ${to}`;
        } else if (type === 'ETH') {
          message = `📤 Enviados *${formatAmount(amount, 18)} ETH* a ${to}`;
        }
      }
      if (message) {
        bot.telegram.sendMessage(telegramUserId, message, { parse_mode: 'Markdown' });
      }
    } catch (err) {
      console.error("Error procesando log de transferencia:", err);
    }
  }

  function parseTransferLog(log, isERC1155) {
    const ifaceErc20 = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
    const ifaceErc721 = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"]);
    const ifaceErc1155 = new ethers.Interface([
      "event TransferSingle(address operator, address indexed from, address indexed to, uint256 indexed id, uint256 value)",
      "event TransferBatch(address operator, address indexed from, address indexed to, uint256[] indexed ids, uint256[] values)"
    ]);

    try {
      let decoded;
      if (!isERC1155) {
        // Intentar decodificar como ERC20 o ERC721 (mismo signature pero difieren indexado del tercer arg)
        try {
          decoded = ifaceErc20.parseLog(log);
          const [from, to, value] = decoded.args;
          // Distinguimos ERC20 vs ERC721 según si tokenId fue indexado o no; aquí asumiremos si parsea como value es ERC20
          const tokenAddress = log.address;
          return { type: 'ERC20', from, to, tokenAddress, amount: value, tokenSymbol: getTokenSymbol(tokenAddress), decimals: getTokenDecimals(tokenAddress) };
        } catch {
          decoded = ifaceErc721.parseLog(log);
          const [from, to, tokenId] = decoded.args;
          const tokenAddress = log.address;
          return { type: 'ERC721', from, to, tokenAddress, tokenId: tokenId.toString(), amount: 1 };
        }
      } else {
        // ERC1155
        decoded = null;
        if (log.topics[0] === TRANSFER_SINGLE_TOPIC) {
          decoded = ifaceErc1155.parseLog(log);
          const [operator, from, to, id, value] = decoded.args;
          return { type: 'ERC1155', from, to, tokenAddress: log.address, tokenId: id.toString(), amount: value.toString() };
        } else if (log.topics[0] === TRANSFER_BATCH_TOPIC) {
          decoded = ifaceErc1155.parseLog(log);
          const [operator, from, to, ids, values] = decoded.args;
          // En batch, si la dirección trackeada está recibiendo, podríamos notificar todos, pero para simplicidad tomamos el primer ID
          return { type: 'ERC1155', from, to, tokenAddress: log.address, tokenId: ids[0].toString(), amount: values[0].toString() };
        }
      }
    } catch (err) {
      console.error("No se pudo decodificar log", log, err);
      return null;
    }
  }

  // Cache simples para símbolos y decimales de tokens ERC20:
  const symbolCache = {};
  const decimalsCache = {};
  function getTokenSymbol(tokenAddr) {
    const addr = tokenAddr.toLowerCase();
    if (symbolCache[addr]) return symbolCache[addr];
    try {
      const erc20 = new ethers.Contract(tokenAddr, ["function symbol() view returns (string)"], provider);
      erc20.symbol().then(sym => { symbolCache[addr] = sym; }).catch(() => {});
    } catch {}
    return null;
  }
  function getTokenDecimals(tokenAddr) {
    const addr = tokenAddr.toLowerCase();
    if (decimalsCache[addr]) return decimalsCache[addr];
    try {
      const erc20 = new ethers.Contract(tokenAddr, ["function decimals() view returns (uint8)"], provider);
      erc20.decimals().then(dec => { decimalsCache[addr] = dec; }).catch(() => {});
    } catch {}
    return null;
  }
}