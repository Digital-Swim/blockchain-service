import * as bitcoin from "bitcoinjs-lib";
import { NetworkType } from "../types/common.js";
import { BitcoinAddressType, BitcoinTransaction } from "../types/bitcoin.js";
import * as bitcoinMessage from 'bitcoinjs-message';

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

export const verifyMessage = (
    message: string,
    address: string,
    signatureBase64: string,
    network: bitcoin.Network = bitcoin.networks.bitcoin
): boolean => {
    const signature = Buffer.from(signatureBase64, 'base64');
    return bitcoinMessage.verify(message, address, signature, network.messagePrefix);
}

export const decodeRawTransaction1 = (rawTxHex: string): BitcoinTransaction => {
    const tx = bitcoin.Transaction.fromHex(rawTxHex);

    return {
        txid: tx.getId(),
        size: tx.byteLength(),
        weight: tx.weight(),
        fee: 0,
        vin: tx.ins.map((input) => ({
            txid: Buffer.from(input.hash).reverse().toString('hex'),
            vout: input.index,
            scriptSig: input.script.toString('hex'),
            value: 0
        })),
        vout: tx.outs.map((output, index) => ({
            n: index,
            value: output.value,
            scriptPubKey: output.script.toString('hex')
        }))
    };
};



export const decodeRawTransaction = (rawTxHex: string, network: bitcoin.Network | NetworkType = bitcoin.networks.bitcoin): BitcoinTransaction => {

    const bitcoinNetwork = (typeof network === "string") ? getNetwork(network) : network

    const tx = bitcoin.Transaction.fromHex(rawTxHex);

    return {
        txid: tx.getId(),
        size: tx.byteLength(),
        weight: tx.weight(),
        fee: 0,
        vin: tx.ins.map((input) => ({
            txid: Buffer.from(input.hash).reverse().toString('hex'),
            vout: input.index,
            scriptSig: input.script.toString('hex'),
            value: 0,
        })),
        vout: tx.outs.map((output, index) => {
            let address = '';
            try {
                address = bitcoin.address.fromOutputScript(output.script, bitcoinNetwork);
            } catch (e) {
                // Could be OP_RETURN or unknown script type
                address = '';
            }
            return {
                n: index,
                value: output.value,
                scriptPubKey: output.script.toString('hex'),
                addresses: [address]
            };
        }),
    };
};


export const log = (message: string, type: "log" | "warn" | "error" = "log") => {
    switch (type) {
        case "error":
            console.error(`[${new Date().toISOString()}] ${message}`);
            break;
        case "warn":
            console.warn(`[${new Date().toISOString()}] ${message}`);
            break;
        default:
            console.log(`[${new Date().toISOString()}] ${message}`);
            break;
    }
}

export const delay = (millsec: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, millsec))
}