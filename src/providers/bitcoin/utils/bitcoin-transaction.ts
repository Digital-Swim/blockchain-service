import * as bip32 from 'bip32';
import * as bitcoin from "bitcoinjs-lib";
import { Target } from 'coinselect';
import { ECPairAPI, ECPairFactory } from "ecpair";
import * as ecc from 'tiny-secp256k1';
import { appConfig } from '../../../config.js';
import { NetworkType } from '../../../types/common.js';
import { UtxoSelector } from './utxo-selector.js';
import { BitcoinAddressType, BitcoinTransactionParams, BitcoinTransactionResult } from '../../../types/bitcoin.js';
import { BitcoinAddress } from '../../../wallets/bitcoin/address.js';
import { getAddressType, getNetwork } from '../../utils/common.js';

const BIP32: bip32.BIP32API = bip32.BIP32Factory(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);

/**
 * Bitcoin provider for creating and signing Bitcoin transactions
 */
export class BitcoinTransaction {

    static async create(params: BitcoinTransactionParams, network: NetworkType | bitcoin.Network): Promise<BitcoinTransactionResult> {

        const { from, toAddress, amountSats, utxos, feeRate, fixedFee, utxoSelectStrategy } = params;

        if (typeof from === "string") throw new Error("Invalid from param, must be an object of BitcoinAddress class");
        if (!utxos?.length) throw new Error('No UTXOs available');
        if (!from.address) throw new Error("Address not provided for source address object, make sure that address is set with BitcoinAddres object");

        const btcNetwork = (typeof network === "string") ? getNetwork(network) : network;
        const fromAddress = from.address!;

        const utxoSelector = new UtxoSelector(utxoSelectStrategy);
        const { inputs, outputs, fee } = utxoSelector.select(utxos!, [{ address: toAddress, value: amountSats }], feeRate, fixedFee);
        if (!inputs?.length || !outputs?.length) throw new Error('UTXO selection failed, please check if there are sufficient funds');

        const psbt = new bitcoin.Psbt({ network: btcNetwork });
        const type = getAddressType(from.address!, network);

        for (const input of inputs) {
            BitcoinTransaction.addInputByType(psbt, input, from, type, btcNetwork)
        }

        var finalOutputs: Target[] = BitcoinTransaction.addOutputs(psbt, outputs, fromAddress);

        psbt.signAllInputs(from.getSignableKey(type));
        psbt.finalizeAllInputs();

        return {
            hex: psbt.extractTransaction().toHex(),
            inputs,
            outputs: finalOutputs,
            fee,
        };

    }

    private static addInputByType(psbt: bitcoin.Psbt, input: any, from: BitcoinAddress, type: BitcoinAddressType, network: bitcoin.Network) {

        const address = from.address!;
        const pubkey = from.getPublicKey();
        const value = input.value;

        if (type === 'p2wpkh') {
            psbt.addInput({
                hash: input.txId,
                index: input.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(address, network),
                    value,
                }
            });
        } else if (type === 'p2sh') {
            const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network });
            const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh, network });
            psbt.addInput({
                hash: input.txId,
                index: input.vout,
                witnessUtxo: {
                    script: p2sh.output!,
                    value,
                },
                redeemScript: p2sh.redeem!.output!,
            });
        } else if (type === 'p2pkh') {
            if (!input.rawTxHex) throw new Error('rawTxHex is required for p2pkh input');
            psbt.addInput({
                hash: input.txId,
                index: input.vout,
                nonWitnessUtxo: Buffer.from(input.rawTxHex, 'hex'),
            });
        } else if (type === 'p2tr') {
            psbt.addInput({
                hash: input.txId,
                index: input.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(address, network),
                    value,
                },
                tapInternalKey: from.getXOnlyPublicKey(),
            });
        } else {
            throw new Error(`Unsupported address type: ${type}`);
        }
    }

    private static addOutputs(psbt: bitcoin.Psbt, outputs: Target[], fromAddress: string): Target[] {
        let finalOutputs: Target[] = [];
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
        return finalOutputs;
    }

}
