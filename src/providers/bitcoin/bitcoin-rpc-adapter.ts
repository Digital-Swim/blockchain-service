import {
    BitcoinAddressInfo,
    BitcoinProvider,
    BitcoinBlock,
    BitcoinFeeEstimates,
    BitcoinMempoolInfo,
    BitcoinTransaction,
    BitcoinUtxo
} from "../../types/bitcoin";

import { BitcoinRpcProvider } from "./rpc/bitcoin-rpc";

export class BitcoinRpcAdapter implements BitcoinProvider {
    private walletName: string;
    private rpc: BitcoinRpcProvider;

    constructor(rpc: BitcoinRpcProvider, walletName = "fallback") {
        this.rpc = rpc;
        this.walletName = walletName;
    }
    baseUrl?: string | undefined;

    async getBlockchainInfo(): Promise<any> {
        return this.rpc.getBlockchainInfo();
    }

    async getBlockAtHeight(height: number): Promise<BitcoinBlock[]> {
        const blockHash = await this.rpc.call<string>("getblockhash", [height]);
        const block = await this.rpc.getBlockByHash(blockHash);
        return [block];
    }

    async getBlockByHash(hash: string): Promise<BitcoinBlock> {
        return this.rpc.getBlockByHash(hash);
    }

    async getBlockTxs(hash: string): Promise<string[]> {
        const block = await this.rpc.getBlockByHash(hash);
        return block.tx ?? [];
    }

    async getLatestBlockHash(): Promise<string> {
        return this.rpc.call<string>("getbestblockhash");
    }

    async getTransaction(txid: string): Promise<BitcoinTransaction> {
        return this.rpc.call("getrawtransaction", [txid, true]);
    }

    async getTransactionHex(txid: string): Promise<string> {
        return this.rpc.getRawTransaction(txid, false);
    }

    async broadcastTransaction(rawTxHex: string): Promise<string> {
        return this.rpc.sendRawTransaction(rawTxHex);
    }

    async getAddressInfo(address: string): Promise<BitcoinAddressInfo> {
        throw new Error("Not implemented")
    }

    async getAddressUtxos(address: string): Promise<BitcoinUtxo[]> {
        return this.rpc.listUnspentAddress(this.walletName, address)
    }

    async getMempoolInfo(): Promise<BitcoinMempoolInfo> {
        return this.rpc.call("getmempoolinfo");
    }

    async getAddressFull(address: string, limit?: number, before?: string): Promise<BitcoinTransaction[]> {
        return Promise.resolve([]);
    }

    async getLatestBlock(): Promise<BitcoinBlock> {
        throw new Error("Method not implemented.");
    }

    async getBalance(address: string): Promise<number> {
        throw new Error("Method not implemented.");
    }

    async getFeeEstimates(): Promise<BitcoinFeeEstimates> {
        throw new Error("Method not implemented.");
    }

}
