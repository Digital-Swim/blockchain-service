import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { BitcoinAddress } from './address.js';
import { NetworkType } from '../../types/common.js';
import { BitcoinTransaction } from '../../providers/bitcoin/utils/bitcoin-transaction.js';

const BIP32 = bip32.BIP32Factory(ecc);
export class BitcoinWallet {

    private seed: Buffer;
    private root: bip32.BIP32Interface;
    private network: bitcoin.networks.Network;
    private mnemonic: string;

    constructor(mnemonic?: string, network: NetworkType = 'mainnet') {

        this.network = BitcoinTransaction.getNetwork(network)

        if (!mnemonic) {
            mnemonic = bip39.generateMnemonic();
        }

        this.mnemonic = mnemonic;

        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic');
        }

        this.seed = bip39.mnemonicToSeedSync(mnemonic);
        this.root = BIP32.fromSeed(this.seed, this.network);
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

    getAddress(index: number, change: number = 0, accountIndex: number = 0): BitcoinAddress {
        const coinType = this.network === bitcoin.networks.bitcoin ? 0 : 1;
        const path = `m/84'/${coinType}'/${accountIndex}'/${change}/${index}`;
        const child = this.root.derivePath(path);
        return new BitcoinAddress({ wif: child.toWIF(), network: this.network });
    }

}
