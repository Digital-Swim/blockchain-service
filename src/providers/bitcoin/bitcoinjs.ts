import * as bip32 from 'bip32';
import * as bip39 from 'bip39';
import * as bitcoin from "bitcoinjs-lib";
import { ECPairAPI, ECPairFactory, ECPairInterface } from "ecpair";
import * as ecc from 'tiny-secp256k1';
import { IBitcoinApiProvider } from "../../types/bitcoin-api";
import { BitcoinjsConfig } from '../../types/bitcoinjs';
import { Utxo } from "../../types/utxo";

const BIP32: bip32.BIP32API = bip32.BIP32Factory(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);

/**
 * Bitcoin provider for creating and signing Bitcoin transactions
 */
export class BitcoinProvider {
    private network: bitcoin.networks.Network;
    private api: IBitcoinApiProvider;

    constructor(apiProvider: IBitcoinApiProvider, config: BitcoinjsConfig) {
        this.api = apiProvider;
        this.network = config.network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
    }

    generateMnemonic(): string {
        return bip39.generateMnemonic();
    }

    getKeyPairFromMnemonic(mnemonic: string, derivationPath = "m/84'/1'/0'/0/0"): ECPairInterface {

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

    async broadcastTransaction(rawTxHex: string): Promise<string> {
        return await this.api.broadcastTransaction(rawTxHex);
    }
}
