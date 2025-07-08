import { FallbackBitcoinApiProvider } from "../providers/bitcoin/fallback-provider.js";
import { BitcoinTransaction } from "../providers/bitcoin/utils/bitcoin-transaction.js";
import { BitcoinParams, BitcoinTransactionResult, BitcoinUtxo } from "../types/bitcoin.js";
import { NetworkType } from "../types/common.js";
import { BitcoinAddress } from "../wallets/bitcoin/address.js";

export class Bitcoin {

    private network: NetworkType
    private fallBackApiProvider: FallbackBitcoinApiProvider;

    constructor(network: NetworkType) {
        this.network = network;
        this.fallBackApiProvider = new FallbackBitcoinApiProvider(network);
    }

    async send(params: BitcoinParams): Promise<any> {

        const { amountSats, from: fromAddress, key: { wif, privateKey }, to, feeRate, fixedFee, utxoSelectStrategy } = params

        // Get Utxos 
        const utxosArr = await this.fallBackApiProvider.getAddressUtxos(fromAddress);

        const utxos = utxosArr.map(bu => ({
            txId: bu.txId,
            vout: bu.vout,
            value: bu.value
        } as BitcoinUtxo));

        const from = new BitcoinAddress({ address: fromAddress, wif, privateKey, network: this.network });

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
        const txid = await this.fallBackApiProvider.broadcastTransaction(tx.hex);

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