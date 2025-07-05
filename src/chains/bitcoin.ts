import { FallbackBitcoinApiProvider } from "../providers/bitcoin/fallback-provider";
import { BitcoinTransaction } from "../providers/bitcoin/utils/bitcoin-transaction";
import { BitcoinParams, BitcoinTransactionResult, BitcoinUtxo } from "../types/bitcoin";
import { NetworkType } from "../types/common";
import { BitcoinAddress } from "../wallets/bitcoin/address";

export class Bitcoin {

    private network: NetworkType
    private fallBackApiProvider: FallbackBitcoinApiProvider;

    constructor(network: NetworkType) {
        this.network = network;
        this.fallBackApiProvider = new FallbackBitcoinApiProvider(network);
    }

    async send(params: BitcoinParams): Promise<any> {

        const { amountSats, from, key: { wif, privateKey }, to, feeRate, fixedFee, utxoSelectStrategy } = params

        // Get Utxos 
        const utxosArr = await this.fallBackApiProvider.getAddressUtxos(from);

        const utxos = utxosArr.map(bu => ({
            txId: bu.txId,
            vout: bu.vout,
            value: bu.value
        } as BitcoinUtxo));

        const fromAddress = new BitcoinAddress({ wif, privateKey, network: this.network });

        const tx: BitcoinTransactionResult = await BitcoinTransaction.create({
            amountSats,
            from: fromAddress,
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