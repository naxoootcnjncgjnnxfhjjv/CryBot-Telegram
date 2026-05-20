export const DEFAULT_WALLETS = {
  ton: [
    'UQChtGxrxo1H74kGde0GNsSKWYG_rhGMKNco-opmWQ1B-yil',
    'UQDY-o0QuHWumsIKstom7sXBzlX2fQ27-cz4r01e9QatvWZU',
    'UQDXGQp2nDtUb985loKLV-AK8q0qyGK9D0vixyUUd4aWVvLE',
    'UQCcLv7JUPrIFZ7-504vbxfTxK6o93nHTwwN-Qv16NsCRy20',
    'UQC9kJgmw5M5DI9tCO2WIuyTYEEoKqRLpCDOfr1d4sCFPtWv',
    'UQBSINhOenZdPyDmV3bfeQ1Hu-Z-zyITBJj0uisC0RmH0GxT'
  ],
  evm: [
    '0x7B9Fc90C99b2ae4711BDEe31049c357999e79B09',
    '0x5e66fa97ebec4a39166cf5c323cdc6a3538f1848',
    '0xf37465E2978D90A8fEaE048D0E15C338d04aa4D6'
  ],
  aptos: [
    '0x11353909627b83813dee8d578a636bd042223308acebda7ff1e4220b861de6eb'
  ]
};

export function mergeConfiguredWallets(configured = {}, defaults = DEFAULT_WALLETS) {
  return {
    ton: [...new Set([...(configured.ton || []), ...(defaults.ton || [])])],
    evm: [...new Set([...(configured.evm || []), ...(defaults.evm || [])])],
    aptos: [...new Set([...(configured.aptos || []), ...(defaults.aptos || [])])]
  };
}
