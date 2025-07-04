import { UTXO } from "coinselect";
import { BlockcypherApiProvider } from "../providers/bitcoin/blockcypher";
import { BlockstreamApiProvider } from "../providers/bitcoin/blockstream";
import { FallbackBitcoinApiProvider } from "../providers/bitcoin/fallback-provider";
import { BitcoinTransaction } from "../providers/bitcoin/utils/bitcoin-transaction";
import { BitcoinParams, BitcoinTransactionParams, BitcoinTransactionResult } from "../types/bitcoin";
import { NetworkType } from "../types/common";
import { BitcoinAddress } from "../wallets/bitcoin/address";
import { BitcoinRpcProvider } from "../providers/bitcoin/bitcoin-rpc";
import { BitcoinRpcAdapter } from "../providers/bitcoin/bitcoin-rpc-adapter";
import { appConfig } from "../config";

export class Bitcoin {

    private network: NetworkType
    private fallBackApiProvider: FallbackBitcoinApiProvider;

    constructor(network: NetworkType) {
        this.network = network;
        this.fallBackApiProvider = new FallbackBitcoinApiProvider([
            new BlockstreamApiProvider(network),
            new BlockcypherApiProvider(network),
            new BitcoinRpcAdapter(new BitcoinRpcProvider(appConfig.bitcoinNodes[0]
            ), appConfig.bitcoinNodes[0].walletName)
        ]);

    }

    async send(params: BitcoinParams, useRPCNode: boolean = false): Promise<any> {

        const { amountSats, from, key: { wif, privateKey }, to, feeRate, fixedFee, utxoSelectStrategy } = params

        // Get Utxos 
        const utxosArr = await this.fallBackApiProvider.getAddressUtxos(from);

        const utxos = utxosArr.map(bu => ({
            txId: bu.txid,
            vout: bu.vout,
            value: bu.value,
        } as UTXO));

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