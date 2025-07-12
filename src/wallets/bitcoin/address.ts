import * as bip32 from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as bitcoinMessage from 'bitcoinjs-message';
import { ECPairAPI, ECPairFactory, ECPairInterface } from "ecpair";
import * as ecc from 'tiny-secp256k1';
import { NetworkType } from '../../types/common.js';

import {
    toXOnly,
} from 'bitcoinjs-lib/src/psbt/bip371.js';

import { Taptree } from 'bitcoinjs-lib/src/types.js';
import { BitcoinAddressType, BitcoinKey, BitcoinTransactionStatus, BitcoinUtxo, UtxoManager } from '../../types/bitcoin.js';
import { getNetwork } from '../../utils/common.js';

const BIP32: bip32.BIP32API = bip32.BIP32Factory(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

export class BitcoinAddress {

    address?: string;
    private utxoManager?: UtxoManager;
    private keyPair: ECPairInterface;
    private network: bitcoin.Network;

    constructor(options?: {
        address?: string;
        key?: BitcoinKey
        network?: NetworkType | bitcoin.Network;
    }, utxoManager?: UtxoManager) {

        const { address, key, network = "mainnet" } = options || {};

        this.address = address;
        this.utxoManager = utxoManager;

        this.network = typeof network === 'string'
            ? getNetwork(network)
            : (network ?? bitcoin.networks.bitcoin);

        if (key?.wif) {
            this.keyPair = ECPair.fromWIF(key.wif, this.network);
        } else if (key?.privateKey) {
            const privKeyBuf = typeof key.privateKey === 'string' ? Buffer.from(key.privateKey, 'hex') : key.privateKey;
            this.keyPair = ECPair.fromPrivateKey(privKeyBuf, { network: this.network });
        } else {
            this.keyPair = ECPair.makeRandom({ network: this.network });
        }
    }

    getOutputScript(type: BitcoinAddressType = 'p2pkh', scriptTree?: Taptree, redeem?: any): Buffer {
        const address = this.getAddress(type, scriptTree, redeem);
        return bitcoin.address.toOutputScript(address, this.network);
    }

    getDescriptor(type: BitcoinAddressType = 'p2pkh'): string {
        const wif = this.getPrivateKeyWIF();
        switch (type) {
            case 'p2pkh':
                return `pkh(${wif})`;
            case 'p2sh':
                return `sh(pkh(${wif}))`;
            case 'p2wpkh':
                return `wpkh(${wif})`;
            case 'p2tr':
                return `tr(${this.getXOnlyPublicKey().toString('hex')})`;
            default:
                throw new Error(`Unsupported address type: ${type}`);
        }
    }

    getKeypair(): ECPairInterface {
        return this.keyPair;
    }

    getPrivateKeyWIF(): string {
        return this.keyPair.toWIF();
    }

    getPrivateKeyHex(): string {
        return Buffer.from(this.keyPair.privateKey!).toString('hex');
    }

    getPublicKey(): Buffer {
        return Buffer.from(this.keyPair.publicKey);
    }

    getXOnlyPublicKey(): Buffer {
        return toXOnly(this.getPublicKey());
    }

    sign(hash: Uint8Array): Buffer {
        return Buffer.from(this.keyPair.sign(hash));
    }

    getAddress(type: BitcoinAddressType = 'p2pkh', scriptTree?: Taptree, redeem?: any): string {
        return this.getPaymentObject(type, scriptTree, redeem).address!
    }

    getPaymentObject(type: BitcoinAddressType = 'p2pkh', scriptTree?: Taptree, redeem?: any): bitcoin.Payment {
        switch (type) {
            case 'p2pkh':
                return bitcoin.payments.p2pkh({
                    pubkey: this.getPublicKey(),
                    network: this.network,
                });
            case 'p2sh':
                return bitcoin.payments.p2sh({
                    redeem: bitcoin.payments.p2wpkh({
                        pubkey: this.getPublicKey(),
                        network: this.network,
                    }),
                    network: this.network,
                });
            case 'p2wpkh':
                return bitcoin.payments.p2wpkh({
                    pubkey: this.getPublicKey(),
                    network: this.network,
                });
            case 'p2tr':
                return bitcoin.payments.p2tr({
                    internalPubkey: this.getXOnlyPublicKey(),
                    scriptTree,
                    redeem,
                    network: this.network,
                });
            default:
                throw new Error('Unsupported address type');
        }
    }

    signMessage(message: string): string {
        const privateKey = this.keyPair.privateKey!;
        const signature = bitcoinMessage.sign(
            message,
            Buffer.from(privateKey),
            this.keyPair.compressed,
            this.network.messagePrefix
        );
        return signature.toString('base64');
    }

    getSignableKey(type: BitcoinAddressType = 'p2pkh'): bitcoin.Signer {

        if (type === 'p2tr') {
            return {
                publicKey: this.getXOnlyPublicKey(),
                sign: (hash: Buffer) => Buffer.from(this.keyPair.sign(hash)),
                signSchnorr: this.keyPair.signSchnorr
                    ? (hash: Buffer) => Buffer.from(this.keyPair.signSchnorr!(hash))
                    : undefined,
            };
        }
        return {
            publicKey: this.getPublicKey(),
            sign: (hash: Buffer) => Buffer.from(this.keyPair.sign(hash)),
        };
    }

    getUtxoManager() {

        if (!this.address) throw new Error("Address not set ");
        if (!this.utxoManager) throw new Error("Utxo manager not set");

        const address = this.address!;
        const manager = this.utxoManager!;
        const network = this.network;

        return {
            addUtxos: (utxos: BitcoinUtxo[]) => manager.addUtxos(utxos),
            getUnspentUtxos: (fromNetwork: boolean = false) => manager.getUnspentUtxos(address, fromNetwork),
            markUtxoAsSpent: (txId: string, vout: number, spentInTxid: string) =>
                manager.markUtxoAsSpent(txId, vout, spentInTxid),
            getTotalBalance: () => manager.getTotalBalance(address),
            deleteUtxos: () => manager.deleteUtxos(address),
            reset: () => manager.reset(address),
            udpateUtxos: (txHex: string, status: BitcoinTransactionStatus) => manager.udpateUtxos(txHex, status, network)
        };
    }

}
