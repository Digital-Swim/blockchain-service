import * as bitcoin from 'bitcoinjs-lib';
import * as bitcoinMessage from 'bitcoinjs-message';

import * as bip32 from 'bip32';
import { ECPairAPI, ECPairFactory, ECPairInterface } from "ecpair";
import * as ecc from 'tiny-secp256k1';
import { BitcoinAddressType } from '../../types/common.js';

const BIP32: bip32.BIP32API = bip32.BIP32Factory(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

export class BitcoinWallet {

    private keyPair: ECPairInterface;
    private network: bitcoin.Network;

    constructor(wif?: string, network: bitcoin.Network = bitcoin.networks.bitcoin) {
        this.network = network;
        this.keyPair = wif
            ? ECPair.fromWIF(wif, network)
            : ECPair.makeRandom({ network });
    }

    getPrivateKeyWIF(): string {
        return this.keyPair.toWIF();
    }

    getPublicKey(): Uint8Array {
        return this.keyPair.publicKey;
    }

    sign(hash:Uint8Array): Uint8Array {
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
                const xOnlyPubkey = this.keyPair.publicKey.slice(1, 33); // Remove 0x02 or 0x03
                return bitcoin.payments.p2tr({
                    internalPubkey: Buffer.from(xOnlyPubkey),
                    network: this.network,
                }).address!;
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

}
