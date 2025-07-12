import * as bip32 from 'bip32';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { getNetwork } from '../../utils/common.js';
import { NetworkType } from '../../types/common.js';
import { BitcoinAddress } from './address.js';

const BIP32 = bip32.BIP32Factory(ecc);
export class BitcoinWallet {

    private seed: Buffer;
    private root: bip32.BIP32Interface;
    private network: bitcoin.networks.Network;
    private mnemonic: string;
    private cointtype;

    constructor(mnemonic?: string, network: NetworkType = 'mainnet') {

        this.network = getNetwork(network)

        if (!mnemonic) {
            mnemonic = bip39.generateMnemonic();
        }

        this.mnemonic = mnemonic;

        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic');
        }

        this.seed = bip39.mnemonicToSeedSync(mnemonic);
        this.root = BIP32.fromSeed(this.seed, this.network);
        this.cointtype = this.network === bitcoin.networks.bitcoin ? 0 : 1;
    }

    getMnemonic(): string {
        return this.mnemonic;
    }

    getXprv(): string {
        return this.root.toBase58();
    }

    getXpub(): string {
        return this.root.neutered().toBase58();
    }

    //Native SegWit single-sig
    getDescriptor(accountIndex = 0): string {
        const derivationPath = `84'/${this.cointtype}'/${accountIndex}'`;
        const fingerprint = Buffer.from(this.root.fingerprint).toString('hex').toUpperCase();
        const xprv = this.root.derivePath(derivationPath).toBase58();
        return `wpkh([${fingerprint}/${derivationPath}]${xprv}/0/*)`;
    }

    getAddress(index: number, change: number = 0, accountIndex: number = 0): BitcoinAddress {
        const path = `m/84'/${this.cointtype}'/${accountIndex}'/${change}/${index}`;
        const child = this.root.derivePath(path);
        return new BitcoinAddress({ key:{wif: child.toWIF()}, network: this.network });
    }

}
