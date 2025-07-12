import { Stack } from "bitcoinjs-lib";
import { FallbackBitcoinProvider } from "../providers/bitcoin/fallback-provider.js";
import { BitcoinTransactionManager } from "../providers/bitcoin/utils/bitcoin-transaction.js";
import { BitcoinUtxoManager } from "../providers/bitcoin/utils/utxo-manager.js";
import { BitcoinParams, BitcoinTransactionResult, BitcoinUtxo } from "../types/bitcoin.js";
import { NetworkType } from "../types/common.js";
import { BitcoinAddress } from "../wallets/bitcoin/address.js";
import * as bitcoin from "bitcoinjs-lib";

export class Bitcoin {

    network: NetworkType
    fallBackBitcoinProvider: FallbackBitcoinProvider;

    constructor(network: NetworkType) {
        this.network = network;
        this.fallBackBitcoinProvider = new FallbackBitcoinProvider(network);
    }

    compile(data: Buffer | Stack) {
        return bitcoin.script.compile(data);
    }

    async create(params: BitcoinParams): Promise<BitcoinTransactionResult> {

        const { amountSats, from: fromAddress, key, to, feeRate, fixedFee, utxoSelectStrategy } = params

        if ((feeRate == null && fixedFee == null) || (feeRate === 0 && fixedFee === 0)) {
            throw new Error("Either feeRate or fixedFee must be provided and greater than zero");
        }

        const from: BitcoinAddress = (fromAddress instanceof BitcoinAddress) ? fromAddress : new BitcoinAddress({ address: fromAddress, key, network: this.network }, new BitcoinUtxoManager(this.fallBackBitcoinProvider));

        const utxos = await from.getUtxoManager().getUnspentUtxos();

        return BitcoinTransactionManager.create({
            amountSats,
            from,
            toAddress: to,
            utxos,
            feeRate,
            fixedFee,
            utxoSelectStrategy
        }, this.network)

    }

    async broadcast(hex: string): Promise<string> {
        return this.fallBackBitcoinProvider.broadcastTransaction(hex);
    }

}


function test() {
    let b = new Bitcoin("regtest")
    b.create(
        {
            amountSats: 10000,
            from: "mtbvtNMCuB3NCuQRvXjjheLT2iuRiuukjn",
            key: {
                wif: "cNR3Ghixdw4QYfY4ZULKBF51kxVtD6EBCDTxBkHmunDTGCwnz8J8"
            },
            to: "bcrt1pp00dvm9ja0wnwckherxmwhxwlt7e8fts0str2nnhnrn7sldznk5spp2rxu",
            feeRate: 1
        }
    ).then(res => { console.log("Done") }).catch(e => {
        console.log(e.message)
    })
}

