import axios from 'axios';
import { appConfig } from '../config.js';
import { NetworkType } from '../types/common.js';
import { BitcoinFeeRate } from '../types/bitcoin.js';

export class MempoolProvider {
    private baseUrl: string;
    private network: NetworkType
    constructor(network: NetworkType) {
        this.network = network
        this.baseUrl = network === 'mainnet' ? appConfig.mempool.mainnet : appConfig.mempool.testnet;
    }

    async getFeeRates(): Promise<BitcoinFeeRate> {
        const res = await axios.get(`${this.baseUrl}/v1/fees/recommended`);
        return { ...res.data, baseUrl: this.baseUrl, network: this.network };
    }
}
