import * as bip32 from 'bip32';
import * as bip39 from 'bip39';
import * as bitcoin from "bitcoinjs-lib";
import { ECPairAPI, ECPairFactory, ECPairInterface } from "ecpair";
import * as ecc from 'tiny-secp256k1';
import { appConfig } from '../../config.js';
import { BitcoinTransactionParams, BitcoinTransactionResult, IBitcoinApiProvider, NetworkType } from '../../types/common.js';
import { UtxoSelector } from './utxo-selector.js';
import { Target, UTXO } from 'coinselect';

const BIP32: bip32.BIP32API = bip32.BIP32Factory(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);

/**
 * Bitcoin provider for creating and signing Bitcoin transactions
 */
export class BitcoinjsProvider {
    private network: bitcoin.networks.Network;
    private api: IBitcoinApiProvider;

    constructor(apiProvider: IBitcoinApiProvider, network: NetworkType) {
        this.api = apiProvider;
        this.network = network === 'mainnet' ? bitcoin.networks.bitcoin : network === 'testnet' ? bitcoin.networks.testnet : network === 'regtest' ? bitcoin.networks.regtest : (() => { throw new Error(`Unsupported network: ${appConfig.network}`); })();
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

    async fetchUtxos(address: string): Promise<UTXO[]> {
        return await this.api.getAddressUtxos(address);
    }

    async broadcastTransaction(rawTxHex: string): Promise<string> {
        return await this.api.broadcastTransaction(rawTxHex);
    }


    /**
     * Creates and signs a Bitcoin transaction using PSBT.
     *
     * @param {BitcoinTransactionParams} params - The transaction parameters.
     * @param {ECPairInterface} params.keyPair - The ECPair used to sign the transaction.
     * @param {string} params.toAddress - The recipient's Bitcoin address (must be a SegWit or Taproot address).
     * @param {number} params.amountSats - The amount to send in satoshis.
     * @param {UTXO[]} [params.utxos] - Optional list of UTXOs to spend. If not provided, they will be fetched automatically.
     * @param {number} [params.fixedFee] - Optional fixed transaction fee (in sats). Use this OR feeRate.
     * @param {number} [params.feeRate] - Optional fee rate (sats/vB). Use this OR fixedFee.
     * @param {UtxoSelectStrategy} [params.utxoSelectStrategy] - Optional UTXO selection strategy.
     *
     * @returns {Promise<BitcoinTransactionResult>} A promise that resolves to the finalized transaction data.
     *
     * @throws {Error} If legacy (non-SegWit) UTXOs or addresses are used. Only SegWit (P2WPKH) or Taproot (P2TR) are supported.
     */
    async createTransaction(params: BitcoinTransactionParams): Promise<BitcoinTransactionResult> {

        const { keyPair, toAddress, amountSats, utxos, feeRate, fixedFee, utxoSelectStrategy } = params;
        const psbt = new bitcoin.Psbt({ network: this.network });
        const fromAddress = this.getAddressFromKeyPair(keyPair);

        // Ensure UTXOs are available
        const utxoList = utxos?.length ? utxos : await this.fetchUtxos(fromAddress);
        if (!utxoList || utxoList.length === 0) {
            throw new Error('No UTXOs available for transaction');
        }

        const targets: Target[] = [{
            address: toAddress, value: amountSats
        }];

        // UTXO selection using strategy
        const utxoSelector = new UtxoSelector(utxoSelectStrategy);
        const { inputs, outputs, fee } = utxoSelector.select(utxoList, targets, feeRate, fixedFee);

        if (!inputs || inputs.length === 0 || !outputs || outputs.length === 0) {
            throw new Error('Failed to select UTXOs, user balance may be not sufficient');
        }

        // Add inputs to PSBT
        for (const utxo of inputs) {
            psbt.addInput({
                hash: utxo.txId,
                index: utxo.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(fromAddress, this.network),
                    value: utxo.value,
                },

            });
        }

        var finalOutputs: Target[] = [];
        outputs.forEach(output => {

            if (!output.address) {
                output.address = fromAddress
            }

            psbt.addOutput({
                address: output.address,
                value: output.value,
            })

            finalOutputs.push({
                address: output.address,
                value: output.value,
            })
        })

        // Sign all inputs
        psbt.signAllInputs({
            publicKey: Buffer.from(keyPair.publicKey),
            sign: (hash: Buffer) => Buffer.from(keyPair.sign(hash)),
        });

        // Finalize and return transaction hex
        psbt.finalizeAllInputs();
        const hex = psbt.extractTransaction().toHex();

        return {
            hex,
            inputs,
            outputs: finalOutputs,
            fee,
        };

    }


}
