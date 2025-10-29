import { ethers } from 'ethers';

// Topic hash de Transfer (ERC20/721)
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
// ERC1155: TransferSingle y TransferBatch
const TRANSFER_SINGLE_TOPIC =
  "0xc3d58168c5aeeecfc83e1d46ad1d72dfc7c27f6d5d4acef5bf37f68e416ec854";
const TRANSFER_BATCH_TOPIC =
  "0x4a39dc06d4c0dbc64b70bfdadcb9442b4d7affc5a367d0d1d4b3fbd91437842c";

// Utilidad simple para formatear cantidades
function formatAmount(amount, decimals) {
  try {
    if (decimals != null) {
      return (Number(amount) / Math.pow(10, Number(decimals))).toFixed(4);
    }
    return amount.toString();
  } catch {
    return amount?.toString?.() ?? String(amount);
  }
}

// Configurar listeners de tracking para una address
export function setupTracking(provider, bot, targetAddress, telegramUserId) {
  const addressLower = targetAddress.toLowerCase();
  const topicAddr = ethers.hexZeroPad(addressLower, 32); // padding de 32 bytes

  // Entradas y salidas ERC20/ERC721
  provider.on({ topics: [TRANSFER_TOPIC, null, topicAddr] }, (log) => handleTransferLog(log, false));
  provider.on({ topics: [TRANSFER_TOPIC, topicAddr, null] }, (log) => handleTransferLog(log, false));

  // Entradas y salidas ERC1155 TransferSingle
  provider.on({ topics: [TRANSFER_SINGLE_TOPIC, null, null, topicAddr] }, (log) => handleTransferLog(log, true));
  provider.on({ topics: [TRANSFER_SINGLE_TOPIC, null, topicAddr] }, (log) => handleTransferLog(log, true));

  // Entradas y salidas ERC1155 TransferBatch
  provider.on({ topics: [TRANSFER_BATCH_TOPIC, null, null, topicAddr] }, (log) => handleTransferLog(log, true));
  provider.on({ topics: [TRANSFER_BATCH_TOPIC, null, topicAddr] }, (log) => handleTransferLog(log, true));

  // Depósitos de ETH nativo (solo en WebSocket providers)
  provider.on('block', async (blockNum) => {
    try {
      const block = await provider.getBlockWithTransactions(blockNum);
      for (const tx of block.transactions) {
        if (!tx.to) continue;
        if (tx.to.toLowerCase() !== addressLower) continue;
        if (!tx.value || tx.value === 0n) continue;
        const ethAmt = ethers.formatEther(tx.value);
        await bot.telegram.sendMessage(
          telegramUserId,
          `📥 Recibido *${ethAmt} ETH* desde ${tx.from}\nTx: ${tx.hash}`,
          { parse_mode: 'Markdown' },
        );
      }
    } catch (e) {
      console.error('Error chequeando depósitos ETH:', e);
    }
  });

  async function handleTransferLog(log, isERC1155) {
    try {
      const parsed = parseTransferLog(log, isERC1155);
      if (!parsed) return;

      const { type, from, to, tokenAddress, tokenId, amount, tokenSymbol, decimals } = parsed;
      const toMe = (to ?? '').toLowerCase() === addressLower;
      const fromMe = (from ?? '').toLowerCase() === addressLower;
      if (!toMe && !fromMe) return;

      let message;
      if (toMe && fromMe) return; // self-transfer, ignorar

      if (toMe) {
        if (type === 'ERC20') {
          message = `📥 Recibido *${formatAmount(amount, decimals)}* de *${tokenSymbol || 'tokens'}*\n${tokenAddress}\nDesde: ${from}`;
        } else if (type === 'ERC721') {
          message = `📥 Recibido NFT ERC721\n${tokenAddress}\nID *${tokenId}*\nDesde: ${from}`;
        } else if (type === 'ERC1155') {
          message = `📥 Recibido NFT ERC1155\n${tokenAddress}\nID *${tokenId}* x${amount}\nDesde: ${from}`;
        }
      } else if (fromMe) {
        if (type === 'ERC20') {
          message = `📤 Enviado *${formatAmount(amount, decimals)}* de *${tokenSymbol || 'tokens'}*\n${tokenAddress}\nA: ${to}`;
        } else if (type === 'ERC721') {
          message = `📤 NFT ERC721 transferido/vendido\n${tokenAddress}\nID *${tokenId}*\nA: ${to}`;
        } else if (type === 'ERC1155') {
          message = `📤 NFT ERC1155 transferido\n${tokenAddress}\nID *${tokenId}* x${amount}\nA: ${to}`;
        }
      }

      if (message) {
        await bot.telegram.sendMessage(telegramUserId, message, { parse_mode: 'Markdown' });
      }
    } catch (err) {
      console.error('Error procesando log de transferencia:', err);
    }
  }

  function parseTransferLog(log, isERC1155) {
    const ifaceErc20 = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]);
    const ifaceErc721 = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
    ]);
    const ifaceErc1155 = new ethers.Interface([
      'event TransferSingle(address operator, address indexed from, address indexed to, uint256 indexed id, uint256 value)',
      'event TransferBatch(address operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
    ]);

    try {
      if (!isERC1155) {
        try {
          const decoded = ifaceErc20.parseLog(log);
          const [from, to, value] = decoded.args;
          const tokenAddress = log.address;
          return {
            type: 'ERC20',
            from,
            to,
            tokenAddress,
            amount: value,
            tokenSymbol: getTokenSymbol(tokenAddress),
            decimals: getTokenDecimals(tokenAddress),
          };
        } catch {
          const decoded = ifaceErc721.parseLog(log);
          const [from, to, tokenId] = decoded.args;
          return {
            type: 'ERC721',
            from,
            to,
            tokenAddress: log.address,
            tokenId: tokenId.toString(),
            amount: 1,
          };
        }
      } else {
        if (log.topics[0] === TRANSFER_SINGLE_TOPIC) {
          const decoded = ifaceErc1155.parseLog(log);
          const [, from, to, id, value] = decoded.args;
          return {
            type: 'ERC1155',
            from,
            to,
            tokenAddress: log.address,
            tokenId: id.toString(),
            amount: value.toString(),
          };
        }
        if (log.topics[0] === TRANSFER_BATCH_TOPIC) {
          const decoded = ifaceErc1155.parseLog(log);
          const [, from, to, ids, values] = decoded.args;
          return {
            type: 'ERC1155',
            from,
            to,
            tokenAddress: log.address,
            tokenId: ids[0].toString(),
            amount: values[0].toString(),
          };
        }
      }
    } catch (err) {
      console.error('No se pudo decodificar log', err);
      return null;
    }
  }

  // Caches para símbolos y decimales (ERC20)
  const symbolCache = {};
  const decimalsCache = {};

  function getTokenSymbol(tokenAddr) {
    const addr = tokenAddr.toLowerCase();
    if (symbolCache[addr]) return symbolCache[addr];
    try {
      const erc20 = new ethers.Contract(
        tokenAddr,
        ['function symbol() view returns (string)'],
        provider,
      );
      erc20
        .symbol()
        .then((sym) => {
          symbolCache[addr] = sym;
        })
        .catch(() => {});
    } catch {}
    return null;
  }

  function getTokenDecimals(tokenAddr) {
    const addr = tokenAddr.toLowerCase();
    if (decimalsCache[addr]) return decimalsCache[addr];
    try {
      const erc20 = new ethers.Contract(
        tokenAddr,
        ['function decimals() view returns (uint8)'],
        provider,
      );
      erc20
        .decimals()
        .then((dec) => {
          decimalsCache[addr] = dec;
        })
        .catch(() => {});
    } catch {}
    return null;
  }
}