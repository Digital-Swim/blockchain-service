import { appConfig } from "../../config.js";
import { BitcoinAddressInfo, BitcoinBlock, BitcoinFeeEstimates, BitcoinMempoolInfo, BitcoinProvider, BitcoinTransaction, BitcoinTransactionStatus, BitcoinUtxo } from "../../types/bitcoin.js";
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
                console.log(`Using fallback provider ${provider.constructor.name}`)
                // @ts-ignore
                const result: T = await (method.apply(provider, args));
                return result;
            } catch (err: any) {
                console.log("errror in fallbalc caught")
                lastError = err;
                console.warn(`[FallbackBitcoinProvider] ${String(methodName)} failed on provider ${provider.constructor.name}:`, err.message);
            }
        }
        throw lastError || new Error(`All providers failed for method ${String(methodName)}`);
    }

    async getBlockchainInfo(): Promise<any> {
        return await this.tryProviders('getBlockchainInfo');
    }

    async getBlockAtHeight(height: number): Promise<BitcoinBlock[]> {
        return await this.tryProviders('getBlockAtHeight', height);
    }

    async getBlockByHash(hash: string): Promise<BitcoinBlock> {
        return await this.tryProviders('getBlockByHash', hash);
    }

    async getBlockTxs(hash: string, txStart?: number): Promise<string[]> {
        return await this.tryProviders('getBlockTxs', hash, txStart);
    }

    async getLatestBlockHash(): Promise<string> {
        return await this.tryProviders('getLatestBlockHash');
    }

    async getTransaction(txid: string): Promise<BitcoinTransaction> {
        return await this.tryProviders('getTransaction', txid);
    }

    async getTransactionStatus(txid: string): Promise<BitcoinTransactionStatus> {
        return await this.tryProviders('getTransactionStatus', txid);
    }
    async getTransactionHex(txid: string): Promise<string> {
        return await this.tryProviders('getTransactionHex', txid);
    }

    async broadcastTransaction(rawTxHex: string): Promise<string> {
        return await this.tryProviders('broadcastTransaction', rawTxHex);
    }

    async getAddressInfo(address: string): Promise<BitcoinAddressInfo> {
        return await this.tryProviders('getAddressInfo', address);
    }

    async getAddressFull?(address: string, limit?: number, before?: string): Promise<BitcoinTransaction[]> {
        return await this.tryProviders('getAddressFull', address, limit, before);
    }

    async getAddressUtxos(address: string, includePending?: boolean): Promise<BitcoinUtxo[]> {
        return await this.tryProviders('getAddressUtxos', address, includePending);
    }

    async getMempoolInfo?(): Promise<BitcoinMempoolInfo> {
        return await this.tryProviders('getMempoolInfo');
    }

    async getFeeEstimates?(): Promise<BitcoinFeeEstimates> {
        return await this.tryProviders('getFeeEstimates');
    }

    async getLatestBlock(): Promise<BitcoinBlock> {
        throw new Error("Method not implemented.");
    }

    async getBalance(address: string): Promise<number> {
        throw new Error("Method not implemented.");
    }

}
