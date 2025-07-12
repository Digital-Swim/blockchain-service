import * as bitcoin from "bitcoinjs-lib";
import { LEAF_VERSION_TAPSCRIPT } from 'bitcoinjs-lib/src/payments/bip341.js';
import { Taptree } from "bitcoinjs-lib/src/types.js";
import { BitcoinUtxoManager } from "../providers/bitcoin/utils/utxo-manager.js";
import { BitcoinTransactionResult, BitcoinUtxo } from "../types/bitcoin.js";
import { NetworkType } from "../types/common.js";
import { CommitTransactionParams, Inscription, RevelaTransactionParams } from "../types/ordinals.js";
import { getNetwork } from "../utils/common.js";
import { BitcoinAddress } from "../wallets/bitcoin/address.js";
import { Bitcoin } from "./bitcoin.js";

export class Oridnals extends Bitcoin {

    constructor(network: NetworkType) {
        super(network)
    }

    compileInscriptionScript(inscription: Inscription, key: Buffer): Buffer {
        const { data, contentType } = inscription;
        return this.compile([
            key,
            bitcoin.opcodes.OP_CHECKSIG,
            bitcoin.opcodes.OP_FALSE,
            bitcoin.opcodes.OP_IF,
            Buffer.from('ord'),
            Buffer.from('01', 'hex'),
            Buffer.from(contentType),
            Buffer.alloc(0),
            Buffer.isBuffer(data) ? data : Buffer.from(data),
            bitcoin.opcodes.OP_ENDIF,
        ])
    }

    createCommit(params: CommitTransactionParams): Promise<BitcoinTransactionResult> {

        const { from: fromAddress, key, inscription, amountSats, feeRate, fixedFee } = params

        const from = new BitcoinAddress({ address: fromAddress, key, network: this.network }, new BitcoinUtxoManager(this.fallBackBitcoinProvider));

        const leafScript = this.compileInscriptionScript(inscription, from.getXOnlyPublicKey());
        const scriptTree: Taptree = { output: leafScript };
        const redeem = { output: leafScript, redeemVersion: LEAF_VERSION_TAPSCRIPT };

        // Get address from tweaked pub key, Send bitcoin to this address from "from" address
        const { address } = from.getPaymentObject('p2tr', scriptTree, redeem);

        return this.create({
            from,
            to: address!,
            amountSats,
            key,
            feeRate,
            fixedFee
        });

    }


    createReveal(params: RevelaTransactionParams): BitcoinTransactionResult {

        const { commitUTXO, from: fromAddress, to, inscription, key, fixedFee, feeRate } = params;

        if ((feeRate == null && fixedFee == null) || (feeRate === 0 && fixedFee === 0)) {
            throw new Error("Either feeRate or fixedFee must be provided and greater than zero");
        }

        const from: BitcoinAddress = (fromAddress instanceof BitcoinAddress) ? fromAddress : new BitcoinAddress({ address: fromAddress, key, network: this.network }, new BitcoinUtxoManager(this.fallBackBitcoinProvider));

        const leafScript = this.compileInscriptionScript(inscription, from.getXOnlyPublicKey());
        const scriptTree: Taptree = { output: leafScript };
        const redeem = { output: leafScript, redeemVersion: LEAF_VERSION_TAPSCRIPT };

        const { output, witness } = from.getPaymentObject('p2tr', scriptTree, redeem);

        let fee = fixedFee ? fixedFee : 0;

        let psbt = this.createPsbtObject(commitUTXO, output, redeem, witness, fixedFee, to!, from)

        if (fee === 0 && feeRate) {
            const size = psbt.extractTransaction().virtualSize();
            fee = (size * feeRate);
            psbt = this.createPsbtObject(commitUTXO, output, redeem, witness, fee, to!, from)
        }

        return {
            hex: psbt.extractTransaction().toHex(),
            inputs: [commitUTXO],
            outputs: [{ value: commitUTXO.value - fee, address: to! }],
            fee
        };

    }

    private createPsbtObject(commitUTXO: BitcoinUtxo, output: any, redeem: any, witness: any, fee: number, to: string, from: BitcoinAddress) {
        const psbt = new bitcoin.Psbt({ network: getNetwork(this.network) });

        psbt.addInput({
            hash: commitUTXO.txId,
            index: commitUTXO.vout,
            witnessUtxo: { value: (commitUTXO.value), script: output! },
        });

        psbt.updateInput(0, {
            tapLeafScript: [
                {
                    leafVersion: redeem.redeemVersion,
                    script: redeem.output,
                    controlBlock: witness![witness!.length - 1],
                },
            ],
        });

        const sendAmount = commitUTXO.value - fee;
        if (sendAmount <= 0) throw new Error('Fee exceeds input value');

        psbt.addOutput({ address: to!, value: (sendAmount) });
        psbt.signInput(0, from.getSignableKey("p2tr"));
        psbt.finalizeInput(0);

        return psbt

    }


}


