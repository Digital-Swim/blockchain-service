import { BitcoinAddressInfo, BitcoinApiProvider, BitcoinBlock, BitcoinFeeEstimates, BitcoinMempoolInfo, BitcoinTransaction, BitcoinUtxo } from "../../types/bitcoin";
import { BitcoinRpcProvider } from "./bitcoin-rpc";

export class FallbackBitcoinApiProvider implements BitcoinApiProvider {
    private providers: BitcoinApiProvider[];

    constructor(providers: BitcoinApiProvider[]) {
        this.providers = providers;
    }

    private async tryProviders<T>(methodName: keyof BitcoinApiProvider, ...args: any[]): Promise<T> {
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

    getAddressUtxos(address: string): Promise<BitcoinUtxo[]> {
        return this.tryProviders('getAddressUtxos', address);
    }

    getMempoolInfo?(): Promise<BitcoinMempoolInfo> {
        return this.tryProviders('getMempoolInfo');
    }

    getFeeEstimates?(): Promise<BitcoinFeeEstimates> {
        return this.tryProviders('getFeeEstimates');
    }
}
