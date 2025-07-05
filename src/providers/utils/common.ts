import * as bitcoin from "bitcoinjs-lib";
import { NetworkType } from "../../types/common.js";
import { BitcoinAddressType } from "../../types/bitcoin.js";

export const getNetwork = (network: NetworkType) => {
    return network === 'mainnet' ? bitcoin.networks.bitcoin : network === 'testnet' ? bitcoin.networks.testnet : network === 'regtest' ? bitcoin.networks.regtest : (() => { throw new Error(`Unsupported network: ${network}`); })();
}

export const getAddressType = (address: string, networkType: NetworkType | bitcoin.Network): BitcoinAddressType => {
    const network = (typeof networkType === "string") ? getNetwork(networkType) : networkType
    // Try Bech32/Bech32m (SegWit)
    try {
        const { version, data } = bitcoin.address.fromBech32(address);
        if (version === 0 && data.length === 20) return 'p2wpkh';
        if (version === 0 && data.length === 32) return 'p2wsh';
        if (version === 1 && data.length === 32) return 'p2tr';
    } catch { }

    // Try Base58 (Legacy)
    try {
        const { version } = bitcoin.address.fromBase58Check(address);
        if (version === network.pubKeyHash) return 'p2pkh';
        if (version === network.scriptHash) return 'p2sh';
    } catch { }

    throw new Error('Unsupported or invalid Bitcoin address');
}