import { appConfig } from "../../config.js";
import { BitcoinAddressInfo, BitcoinProvider, BitcoinBlock, BitcoinFeeEstimates, BitcoinMempoolInfo, BitcoinTransaction, BitcoinUtxo } from "../../types/bitcoin.js";
import { NetworkType } from "../../types/common.js";
import { BlockcypherApiProvider } from "./api/blockcypher.js";
import { BlockstreamApiProvider } from "./api/blockstream.js";
import { BitcoinRpcAdapter } from "./bitcoin-rpc-adapter.js";
import { BitcoinRpcProvider } from "./rpc/bitcoin-rpc.js";

export class FallbackBitcoinProvider implements BitcoinProvider {
    baseUrl?: string | undefined;
    private providers: BitcoinProvider[];

    constructor(network: NetworkType, providers?: BitcoinProvider[]) {

        if (providers)
            this.providers = providers;
        else {
            const selectedProviders = appConfig.selectedProviders || ["blockstream"];

            this.providers = selectedProviders.flatMap((provider) => {
                switch (provider) {
                    case 'blockstream':
                        return [new BlockstreamApiProvider(network)];

                    case 'blockcypher':
                        return [new BlockcypherApiProvider(network)];

                    case 'bitcoinNodes':
                        return appConfig.bitcoinNodes.map((node) =>
                            new BitcoinRpcAdapter(new BitcoinRpcProvider(node), node.walletName)
                        );

                    default:
                        throw new Error(`Unknown provider: ${provider}`);
                }
            });
        }
    }


    private async tryProviders<T>(methodName: keyof BitcoinProvider, ...args: any[]): Promise<T> {
        let lastError: any;
        for (const provider of this.providers) {
            const method = provider[methodName];
            if (typeof method !== 'function') {
                continue; // skip if method not implemented by this provider
            }
            try {
                // @ts-ignore
                const result: T = await method.apply(provider, args);
                return result;
            } catch (err) {
                lastError = err;
                console.warn(`[FallbackBitcoinProvider] ${String(methodName)} failed on provider ${provider.constructor.name}:`, err);
            }
        }
        throw lastError || new Error(`All providers failed for method ${String(methodName)}`);
    }

    getBlockchainInfo(): Promise<any> {
        return this.tryProviders('getBlockchainInfo');
    }

    getBlockAtHeight(height: number): Promise<BitcoinBlock[]> {
        return this.tryProviders('getBlockAtHeight', height);
    }

    getBlockByHash(hash: string): Promise<BitcoinBlock> {
        return this.tryProviders('getBlockByHash', hash);
    }

    getBlockTxs(hash: string, txStart?: number): Promise<string[]> {
        return this.tryProviders('getBlockTxs', hash, txStart);
    }

    getLatestBlockHash(): Promise<string> {
        return this.tryProviders('getLatestBlockHash');
    }

    getTransaction(txid: string): Promise<BitcoinTransaction> {
        return this.tryProviders('getTransaction', txid);
    }

    getTransactionHex(txid: string): Promise<string> {
        return this.tryProviders('getTransactionHex', txid);
    }

    broadcastTransaction(rawTxHex: string): Promise<string> {
        return this.tryProviders('broadcastTransaction', rawTxHex);
    }

    getAddressInfo(address: string): Promise<BitcoinAddressInfo> {
        return this.tryProviders('getAddressInfo', address);
    }

    getAddressFull?(address: string, limit?: number, before?: string): Promise<BitcoinTransaction[]> {
        return this.tryProviders('getAddressFull', address, limit, before);
    }

    getAddressUtxos(address: string, includePending?: boolean): Promise<BitcoinUtxo[]> {
        return this.tryProviders('getAddressUtxos', address, includePending);
    }

    getMempoolInfo?(): Promise<BitcoinMempoolInfo> {
        return this.tryProviders('getMempoolInfo');
    }

    getFeeEstimates?(): Promise<BitcoinFeeEstimates> {
        return this.tryProviders('getFeeEstimates');
    }

    getLatestBlock(): Promise<BitcoinBlock> {
        throw new Error("Method not implemented.");
    }

    getBalance(address: string): Promise<number> {
        throw new Error("Method not implemented.");
    }

}
