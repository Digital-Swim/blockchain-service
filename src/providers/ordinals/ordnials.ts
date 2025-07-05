
import * as bitcoin from 'bitcoinjs-lib';
import {
    LEAF_VERSION_TAPSCRIPT
} from 'bitcoinjs-lib/src/payments/bip341.js';
import { Taptree } from 'bitcoinjs-lib/src/types.js';
import { NetworkType } from '../../types/common.js';
import { CommitTrasanctionParams, Inscription, RevelaTransactionParams } from '../../types/ordinals.js';
import { BitcoinRpcProvider } from '../bitcoin/rpc/bitcoin-rpc.js';
import { BitcoinTransaction } from '../bitcoin/utils/bitcoin-transaction.js';
import { BitcoinUtxo } from '../../types/bitcoin.js';



export class OrdinalProvider {

    protected network: bitcoin.networks.Network;


    // Chain data provider for testing , this has to be injected and common interface for RPC , 3rd Pary A
    rpc = new BitcoinRpcProvider({
        url: 'http://127.0.0.1:18443',
        username: 'ranjit',
        password: 'ranjit',
    });

    constructor(network: NetworkType) {
        this.network = BitcoinTransaction.getNetwork(network)
    }

    inscribe() {

    }

    compileInscriptionScript(inscription: Inscription, key: Buffer): Buffer {
        const { data, contentType } = inscription;
        return bitcoin.script.compile([
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
        ]);
    }

    async commit(params: CommitTrasanctionParams) {

        console.log("creaeting commit tx")

        const { from, inscription } = params

        const leafScript = this.compileInscriptionScript(inscription, from.getXOnlyPublicKey());
        const scriptTree: Taptree = { output: leafScript };
        const redeem = { output: leafScript, redeemVersion: LEAF_VERSION_TAPSCRIPT };

        // Get address from tweaked pub key ,
        const { address } = from.getPaymentObject('p2tr', scriptTree, redeem);
        const utxos = await this.rpc.listUnspentAddress("test-rpc", from.getAddress("p2wpkh"));
        console.log(utxos.length);

        // Sending value to this address and locking the script 
        const { fee, hex } = await BitcoinTransaction.create(
            {
                from,
                toAddress: address!,
                amountSats: 10000,
                utxos: utxos,
                feeRate: 1
            }, this.network
        )

        console.log(hex);
        const txId = await this.rpc.sendRawTransaction(hex);
        console.log(txId);

        console.log("commit tx sent")
        return {
            txId,
            value: 10000,
            vout: 0
        } as BitcoinUtxo;
    }

    async reveal(params: RevelaTransactionParams) {

        console.log("creaeting reveal tx")

        const { commitUTXO, from, to, inscription } = params;

        const leafScript = this.compileInscriptionScript(inscription, from.getXOnlyPublicKey());
        const scriptTree: Taptree = { output: leafScript };
        const redeem = { output: leafScript, redeemVersion: LEAF_VERSION_TAPSCRIPT };

        const { output, witness } = from.getPaymentObject('p2tr', scriptTree, redeem);
        const psbt = new bitcoin.Psbt({ network: this.network });

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

        const fee = 1000;
        const sendAmount = commitUTXO.value - fee;

        psbt.addOutput({ address: to!, value: (sendAmount) });
        psbt.signInput(0, from.getSignableKey("p2tr"));
        psbt.finalizeInput(0);

        const tx = psbt.extractTransaction();
        const hex = tx.toHex();
        console.log(hex);

        let c = await this.rpc.sendRawTransaction(hex);

        return c


    }

}


