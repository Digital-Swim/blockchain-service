import axios from 'axios';
import { appConfig } from '../../config.js';

export class MempoolProvider {
    private baseUrl: string;

    constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
        this.baseUrl = network === 'testnet' ? appConfig.mempool.testnet : appConfig.mempool.mainnet;
    }

    async getFeeRates(): Promise<{
        fastestFee: number;
        halfHourFee: number;
        hourFee: number;
        economyFee?: number;
        minimumFee?: number;
    }> {
        const res = await axios.get(`${this.baseUrl}/v1/fees/recommended`);
        return res.data;
    }
}
