import * as bitcoin from 'bitcoinjs-lib';
import * as bitcoinMessage from 'bitcoinjs-message';
import * as bip32 from 'bip32';
import { ECPairAPI, ECPairFactory, ECPairInterface } from "ecpair";
import * as ecc from 'tiny-secp256k1';
import { BitcoinAddressType } from '../../types/common.js';

import {
    toXOnly,
} from 'bitcoinjs-lib/src/psbt/bip371.js';

import { Taptree } from 'bitcoinjs-lib/src/types.js';

const BIP32: bip32.BIP32API = bip32.BIP32Factory(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

export class BitcoinWallet {

    private keyPair: ECPairInterface;
    private network: bitcoin.Network;

    constructor(options?: {
        wif?: string;
        privateKey?: string | Buffer;
        network?: bitcoin.Network;
    }) {
        const { wif, privateKey, network = bitcoin.networks.bitcoin } = options || {};
        this.network = network;

        if (wif) {
            this.keyPair = ECPair.fromWIF(wif, network);
        } else if (privateKey) {
            const privKeyBuf = typeof privateKey === 'string' ? Buffer.from(privateKey, 'hex') : privateKey;
            this.keyPair = ECPair.fromPrivateKey(privKeyBuf, { network });
        } else {
            this.keyPair = ECPair.makeRandom({ network });
        }
    }

    getKeypair(): ECPairInterface {
        return this.keyPair;
    }

    getPrivateKeyWIF(): string {
        return this.keyPair.toWIF();
    }

    getPrivateKeyHex(): string {
        return this.keyPair.privateKey!.toString();
    }

    getPublicKey(): Uint8Array {
        return this.keyPair.publicKey;
    }
    sign(hash: Uint8Array): Uint8Array {
        return this.keyPair.sign(hash);
    }

    getAddress(type: BitcoinAddressType = 'p2pkh'): string {
        switch (type) {
            case 'p2pkh':
                return bitcoin.payments.p2pkh({
                    pubkey: Buffer.from(this.keyPair.publicKey),
                    network: this.network,
                }).address!;
            case 'p2sh':
                return bitcoin.payments.p2sh({
                    redeem: bitcoin.payments.p2wpkh({
                        pubkey: Buffer.from(this.keyPair.publicKey),
                        network: this.network,
                    }),
                    network: this.network,
                }).address!;
            case 'p2wpkh':
                return bitcoin.payments.p2wpkh({
                    pubkey: Buffer.from(this.keyPair.publicKey),
                    network: this.network,
                }).address!;
            case 'p2tr':
                const xOnlyPubkey = this.keyPair.publicKey.slice(1, 33);
                return bitcoin.payments.p2tr({
                    internalPubkey: Buffer.from(xOnlyPubkey),
                    network: this.network,
                }).address!;
            default:
                throw new Error('Unsupported address type');
        }
    }

    getPaymentObject(type: BitcoinAddressType = 'p2pkh', scriptTree?: Taptree): bitcoin.Payment {
        switch (type) {
            case 'p2pkh':
                return bitcoin.payments.p2pkh({
                    pubkey: Buffer.from(this.keyPair.publicKey),
                    network: this.network,
                });
            case 'p2sh':
                return bitcoin.payments.p2sh({
                    redeem: bitcoin.payments.p2wpkh({
                        pubkey: Buffer.from(this.keyPair.publicKey),
                        network: this.network,
                    }),
                    network: this.network,
                });
            case 'p2wpkh':
                return bitcoin.payments.p2wpkh({
                    pubkey: Buffer.from(this.keyPair.publicKey),
                    network: this.network,
                });
            case 'p2tr':
                const xOnlyPubkey = toXOnly(Buffer.from(this.keyPair.publicKey));
                return bitcoin.payments.p2tr({
                    internalPubkey: xOnlyPubkey,
                    scriptTree,
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

    static verifyMessage(
        message: string,
        address: string,
        signatureBase64: string,
        network: bitcoin.Network = bitcoin.networks.bitcoin
    ): boolean {
        const signature = Buffer.from(signatureBase64, 'base64');
        return bitcoinMessage.verify(message, address, signature, network.messagePrefix);
    }

    /**
     * Returns the appropriate key for PSBT signing depending on address type
     */
    getSignableKey(type: BitcoinAddressType): {
        publicKey: Buffer;
        sign: (hash: Buffer) => Buffer;
        signSchnorr?: (hash: Buffer) => Buffer;
    } {
        const privKey = this.keyPair.privateKey!;
        const pubKey = Buffer.from(this.keyPair.publicKey);

        if (type === 'p2tr') {
            const xOnly = toXOnly(pubKey);
            return {
                publicKey: xOnly,
                sign: () => {
                    throw new Error('Use signSchnorr for Taproot');
                },
                signSchnorr: (hash: Buffer) => {
                    return Buffer.from(ecc.signSchnorr!(hash, privKey));
                },
            };
        }

        return {
            publicKey: pubKey,
            sign: (hash: Buffer) => Buffer.from(this.keyPair.sign(hash)),
        };
    }


    

}
