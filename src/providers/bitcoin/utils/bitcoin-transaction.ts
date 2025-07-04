import * as bip32 from 'bip32';
import * as bitcoin from "bitcoinjs-lib";
import { Target } from 'coinselect';
import { ECPairAPI, ECPairFactory } from "ecpair";
import * as ecc from 'tiny-secp256k1';
import { appConfig } from '../../../config.js';
import { NetworkType } from '../../../types/common.js';
import { UtxoSelector } from './utxo-selector.js';
import { BitcoinTransactionParams, BitcoinTransactionResult } from '../../../types/bitcoin.js';

const BIP32: bip32.BIP32API = bip32.BIP32Factory(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);

/**
 * Bitcoin provider for creating and signing Bitcoin transactions
 */
export class BitcoinTransaction {

    static getNetwork(network: NetworkType) {
        return network === 'mainnet' ? bitcoin.networks.bitcoin : network === 'testnet' ? bitcoin.networks.testnet : network === 'regtest' ? bitcoin.networks.regtest : (() => { throw new Error(`Unsupported network: ${appConfig.network}`); })();
    }


    static async create(params: BitcoinTransactionParams, network: NetworkType | bitcoin.Network): Promise<BitcoinTransactionResult> {


        const { from, toAddress, amountSats, utxos, feeRate, fixedFee, utxoSelectStrategy } = params;
        const btcNetwork = (typeof network === "string") ? BitcoinTransaction.getNetwork(network) : network;

        if (typeof from === "string") throw new Error("Invalid from param, must be an object of BitcoinAddress class");

        const psbt = new bitcoin.Psbt({ network: btcNetwork });
        const fromAddress = from.getAddress('p2wpkh');

        if (!utxos?.length) throw new Error('No UTXOs available');

        const utxoSelector = new UtxoSelector(utxoSelectStrategy);
        const { inputs, outputs, fee } = utxoSelector.select(utxos!, [{ address: toAddress, value: amountSats }], feeRate, fixedFee);

        if (!inputs?.length || !outputs?.length) throw new Error('UTXO selection failed, please check if there are sufficient funds');

        for (const input of inputs) {
            psbt.addInput({
                hash: input.txId,
                index: input.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(fromAddress, btcNetwork),
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

        psbt.signAllInputs(from.getSignableKey());
        psbt.finalizeAllInputs();

        return {
            hex: psbt.extractTransaction().toHex(),
            inputs,
            outputs: finalOutputs,
            fee,
        };

    }

}
