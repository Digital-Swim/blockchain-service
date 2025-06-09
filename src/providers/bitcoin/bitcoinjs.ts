import * as bip32 from 'bip32';
import * as bip39 from 'bip39';
import * as bitcoin from "bitcoinjs-lib";
import { ECPairAPI, ECPairFactory, ECPairInterface } from "ecpair";
import * as ecc from 'tiny-secp256k1';
import { appConfig } from '../../config.js';
import { BitcoinjsConfig, IBitcoinApiProvider, Utxo } from '../../types.js';

const BIP32: bip32.BIP32API = bip32.BIP32Factory(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);

/**
 * Bitcoin provider for creating and signing Bitcoin transactions
 */
export class BitcoinjsProvider {
    private network: bitcoin.networks.Network;
    private api: IBitcoinApiProvider;

    constructor(apiProvider: IBitcoinApiProvider, config: BitcoinjsConfig) {
        this.api = apiProvider;
        this.network = appConfig.network === 'mainnet' ? bitcoin.networks.bitcoin : appConfig.network === 'testnet' ? bitcoin.networks.testnet : appConfig.network === 'regtest' ? bitcoin.networks.regtest : (() => { throw new Error(`Unsupported network: ${appConfig.network}`); })();
    }

    generateMnemonic(): string {
        return bip39.generateMnemonic();
    }

    getKeyPairFromMnemonic(mnemonic: string, derivationPath?: string): ECPairInterface {
        if (!derivationPath) {
            derivationPath = this.network === bitcoin.networks.bitcoin
                ? "m/84'/0'/0'/0/0" // mainnet
                : "m/84'/1'/0'/0/0"; // testnet and regtest
        }

        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const root = BIP32.fromSeed(seed, this.network);
        const child = root.derivePath(derivationPath);

        if (!child.privateKey) {
            throw new Error('Failed to derive private key');
        }

        return ECPair.fromPrivateKey(child.privateKey, { network: this.network });
    }


    getKeyPairFromWIF(wif: string): ECPairInterface {
        try {
            return ECPair.fromWIF(wif, this.network);
        } catch (e) {
            throw new Error('Invalid WIF or incompatible network');
        }
    }

    getAddressFromKeyPair(keyPair: ECPairInterface): string {
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: Buffer.from(keyPair.publicKey),
            network: this.network,
        });
        if (!address) throw new Error('Failed to generate address');
        return address;
    }

    async fetchUtxos(address: string): Promise<Utxo[]> {
        return await this.api.getAddressUtxos(address);
    }

    async createTransaction(params: {
        keyPair: ECPairInterface;
        toAddress: string;
        amountSats: number;
        feeSats: number;
        utxos: Utxo[];
    }): Promise<string> {
        const { keyPair, toAddress, amountSats, feeSats, utxos } = params;
        const psbt = new bitcoin.Psbt({ network: this.network });
        const fromAddress = this.getAddressFromKeyPair(keyPair);

        let totalInput = 0;

        for (const utxo of utxos) {
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(fromAddress, this.network),
                    value: utxo.value,
                },
            });
            totalInput += utxo.value;
            if (totalInput >= amountSats + feeSats) break;
        }

        if (totalInput < amountSats + feeSats) {
            throw new Error('Insufficient selected UTXOs for this transaction');
        }

        psbt.addOutput({ address: toAddress, value: amountSats });

        const change = totalInput - amountSats - feeSats;
        if (change > 0) {
            psbt.addOutput({ address: fromAddress, value: change });
        }

        psbt.signAllInputs({
            publicKey: Buffer.from(keyPair.publicKey),
            sign: (hash: Buffer) => Buffer.from(keyPair.sign(hash)),
        });

        psbt.finalizeAllInputs();

        return psbt.extractTransaction().toHex();
    }

    async createTransactionDynamicFees(params: {
        keyPair: ECPairInterface;
        toAddress: string;
        amountSats: number;
        utxos: Utxo[];
        feeRate?: number; // Optional, sat/vByte. Default: 1 sat/vByte (for regtest)
    }): Promise<string> {
        const { keyPair, toAddress, amountSats, utxos, feeRate = 1 } = params;
        const psbt = new bitcoin.Psbt({ network: this.network });
        const fromAddress = this.getAddressFromKeyPair(keyPair);

        let totalInput = 0;
        const selectedUtxos: Utxo[] = [];

        for (const utxo of utxos) {
            selectedUtxos.push(utxo);
            totalInput += utxo.value;

            // Estimate tx size:
            const inputCount = selectedUtxos.length;
            const outputCount = 2; // one to recipient, one change (worst case)
            const estimatedSize = inputCount * 68 + outputCount * 31 + 10; // conservative estimate
            const estimatedFee = Math.ceil(estimatedSize * feeRate);

            if (totalInput >= amountSats + estimatedFee) break;
        }

        const inputCount = selectedUtxos.length;
        const outputCount = 2; // assume change
        const estimatedSize = inputCount * 68 + outputCount * 31 + 10;
        const feeSats = Math.ceil(estimatedSize * feeRate);

        if (totalInput < amountSats + feeSats) {
            throw new Error('Insufficient UTXOs to cover amount + fee');
        }

        for (const utxo of selectedUtxos) {
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(fromAddress, this.network),
                    value: utxo.value,
                },
            });
        }

        psbt.addOutput({ address: toAddress, value: amountSats });

        const change = totalInput - amountSats - feeSats;
        if (change > 0) {
            psbt.addOutput({ address: fromAddress, value: change });
        }

        psbt.signAllInputs({
            publicKey: Buffer.from(keyPair.publicKey),
            sign: (hash: Buffer) => Buffer.from(keyPair.sign(hash)),
        });

        psbt.finalizeAllInputs();

        return psbt.extractTransaction().toHex();
    }

    async broadcastTransaction(rawTxHex: string): Promise<string> {
        return await this.api.broadcastTransaction(rawTxHex);
    }
}
