function sendSignatureLink(ctx, txData, network, label = "Transacción") {
  const encoded = Buffer.from(JSON.stringify(txData)).toString('base64url');
  let link, walletName;

  switch (network) {
    case "TON":
      walletName = "Tonkeeper";
      link = `https://tonconnect.com/sign?payload=${encoded}`;
      break;
    case "EVM":
      walletName = "MetaMask";
      link = `https://metamask.app.link/send/${txData.to}?value=${txData.value}`;
      break;
    default:
      walletName = "Wallet";
      link = "#";
  }

  ctx.telegram.sendMessage(ctx.chat.id,
    `💎 ${label}\nRed: ${network}\nRevisa y firma desde tu wallet.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: `Firmar en ${walletName}`, url: link }],
          [{ text: "Cancelar", callback_data: "cancel_sign" }]
        ]
      }
    }
  );
}

module.exports = { sendSignatureLink };
