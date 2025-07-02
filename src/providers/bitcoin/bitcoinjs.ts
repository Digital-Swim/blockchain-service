import * as bip32 from 'bip32';
import * as bitcoin from "bitcoinjs-lib";
import { Target, UTXO } from 'coinselect';
import { ECPairAPI, ECPairFactory } from "ecpair";
import * as ecc from 'tiny-secp256k1';
import { appConfig } from '../../config.js';
import { BitcoinTransactionParams, BitcoinTransactionResult, IBitcoinApiProvider, NetworkType } from '../../types/common.js';
import { UtxoSelector } from './utxo-selector.js';

const BIP32: bip32.BIP32API = bip32.BIP32Factory(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);

/**
 * Bitcoin provider for creating and signing Bitcoin transactions
 */
export class BitcoinjsProvider {
    protected network: bitcoin.networks.Network;
    private api: IBitcoinApiProvider;

    constructor(apiProvider: IBitcoinApiProvider, network: NetworkType) {
        this.api = apiProvider;
        this.network = network === 'mainnet' ? bitcoin.networks.bitcoin : network === 'testnet' ? bitcoin.networks.testnet : network === 'regtest' ? bitcoin.networks.regtest : (() => { throw new Error(`Unsupported network: ${appConfig.network}`); })();
    }


    async fetchUtxos(address: string): Promise<UTXO[]> {
        return await this.api.getAddressUtxos(address);
    }

    async broadcastTransaction(rawTxHex: string): Promise<string> {
        return await this.api.broadcastTransaction(rawTxHex);
    }

    async createTransaction(params: BitcoinTransactionParams): Promise<BitcoinTransactionResult> {

        const { wallet, toAddress, amountSats, utxos, feeRate, fixedFee, utxoSelectStrategy } = params;

        const psbt = new bitcoin.Psbt({ network: this.network });
        const fromAddress = wallet.getAddress();

        const availableUtxos = utxos?.length ? utxos : await this.fetchUtxos(fromAddress);
        if (!availableUtxos.length) throw new Error('No UTXOs available');

        const utxoSelector = new UtxoSelector(utxoSelectStrategy);
        const { inputs, outputs, fee } = utxoSelector.select(availableUtxos, [{ address: toAddress, value: amountSats }], feeRate, fixedFee);

        if (!inputs.length || !outputs.length) throw new Error('UTXO selection failed, please check if there are sufficient funds');

        for (const input of inputs) {
            psbt.addInput({
                hash: input.txId,
                index: input.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(fromAddress, this.network),
                    value: input.value,
                }
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
        });


        psbt.signAllInputs({ publicKey: Buffer.from(wallet.getPublicKey()), sign: (hash) => Buffer.from(wallet.sign(hash)) });

        psbt.finalizeAllInputs();

        return {
            hex: psbt.extractTransaction().toHex(),
            inputs,
            outputs,
            fee,
        };
    }

}
