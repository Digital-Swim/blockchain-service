import { FallbackBitcoinProvider } from "../providers/bitcoin/fallback-provider.js";
import { BitcoinTransaction } from "../providers/bitcoin/utils/bitcoin-transaction.js";
import { LocalUtxoManager } from "../providers/bitcoin/utils/utxo-manager.js";
import { BitcoinParams, BitcoinTransactionResult, BitcoinUtxo } from "../types/bitcoin.js";
import { NetworkType } from "../types/common.js";
import { BitcoinAddress } from "../wallets/bitcoin/address.js";

export class Bitcoin {

    private network: NetworkType
    private fallBackBitcoinProvider: FallbackBitcoinProvider;

    constructor(network: NetworkType) {
        this.network = network;
        this.fallBackBitcoinProvider = new FallbackBitcoinProvider(network);
    }

    async send(params: BitcoinParams): Promise<any> {

        const { amountSats, from: fromAddress, key: { wif, privateKey }, to, feeRate, fixedFee, utxoSelectStrategy } = params

        const from = new BitcoinAddress({ address: fromAddress, wif, privateKey, network: this.network }, new LocalUtxoManager(this.fallBackBitcoinProvider));

        // Get Utxos 
        const utxosArr = await from.getUtxoManager().getUnspentUtxos();

        const utxos = utxosArr.map(bu => ({
            txId: bu.txId,
            vout: bu.vout,
            value: bu.value
        } as BitcoinUtxo));


        const tx: BitcoinTransactionResult = await BitcoinTransaction.create({
            amountSats,
            from,
            toAddress: to,
            utxos,
            feeRate,
            fixedFee,
            utxoSelectStrategy
        }, this.network)

        console.log(JSON.stringify(tx))

        // Publish 
        const txid = await this.fallBackBitcoinProvider.broadcastTransaction(tx.hex);

        console.log(txid)


    }


}


let b = new Bitcoin("regtest")

b.send(
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