import * as bitcoin from 'bitcoinjs-lib';
import * as bitcoinMessage from 'bitcoinjs-message';
import * as bip32 from 'bip32';
import { ECPairAPI, ECPairFactory, ECPairInterface } from "ecpair";
import * as ecc from 'tiny-secp256k1';
import { BitcoinAddressType, NetworkType } from '../../types/common.js';

import {
    toXOnly,
} from 'bitcoinjs-lib/src/psbt/bip371.js';

import { Taptree } from 'bitcoinjs-lib/src/types.js';
import { BitcoinTransaction } from '../../providers/bitcoin/utils/bitcoin-transaction.js';

const BIP32: bip32.BIP32API = bip32.BIP32Factory(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

export class BitcoinAddress {

    private keyPair: ECPairInterface;
    private network: bitcoin.Network;

    constructor(options?: {
        wif?: string;
        privateKey?: string | Buffer;
        network?: NetworkType | bitcoin.Network;
    }) {

        const { wif, privateKey, network = "mainnet" } = options || {};

        this.network = typeof network === 'string'
            ? BitcoinTransaction.getNetwork(network)
            : (network ?? bitcoin.networks.bitcoin);

        if (wif) {
            this.keyPair = ECPair.fromWIF(wif, this.network);
        } else if (privateKey) {
            const privKeyBuf = typeof privateKey === 'string' ? Buffer.from(privateKey, 'hex') : privateKey;
            this.keyPair = ECPair.fromPrivateKey(privKeyBuf, { network: this.network });
        } else {
            this.keyPair = ECPair.makeRandom({ network: this.network });
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

    /**
     * Returns the appropriate key for PSBT signing depending on address type
     */
    getSignableKey(): bitcoin.Signer {
        return {
            publicKey: this.getXOnlyPublicKey(),
            sign: (hash: Buffer) => Buffer.from(this.keyPair.sign(hash)),
            signSchnorr: this.keyPair.signSchnorr
                ? (hash: Buffer) => Buffer.from(this.keyPair.signSchnorr!(hash))
                : undefined,
        }
    }

    static verifyMessage(
        message: string,
        address: string,
        signatureBase64: string,
        network: bitcoin.Network = bitcoin.networks.bitcoin
    ): boolean {
        const signature = Buffer.from(signatureBase64, 'base64');
        return bitcoinMessage.verify(message, address, signature, network.messagePrefix);
    }


}
