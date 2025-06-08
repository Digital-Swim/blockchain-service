import axios from 'axios';
import { blockstreamConfig } from '../../config/blockstram.js';

export class BlockstreamApiProvider {
    private baseUrl: string;

    constructor() {
        const network = blockstreamConfig.network;
        this.baseUrl =
            network === 'testnet'
                ? blockstreamConfig.urls.testnet
                : blockstreamConfig.urls.mainnet;
    }

    async getLatestBlockHash(): Promise<string> {
        const res = await axios.get(`${this.baseUrl}/blocks/tip/hash`);
        return res.data;
    }

    async getBlockByHash(blockHash: string): Promise<any> {
        const res = await axios.get(`${this.baseUrl}/block/${blockHash}`);
        return res.data;
    }

    async getTransaction(txid: string): Promise<any> {
        const res = await axios.get(`${this.baseUrl}/tx/${txid}`);
        return res.data;
    }

    async getAddressInfo(address: string): Promise<any> {
        const res = await axios.get(`${this.baseUrl}/address/${address}`);
        return res.data;
    }

    async getAddressUtxos(address: string): Promise<any[]> {
        const res = await axios.get(`${this.baseUrl}/address/${address}/utxo`);
        return res.data;
    }

    async broadcastTransaction(rawTxHex: string): Promise<string> {
        const res = await axios.post(`${this.baseUrl}/tx`, rawTxHex, {
            headers: { 'Content-Type': 'text/plain' },
        });
        return res.data;
    }
}
