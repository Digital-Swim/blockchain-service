import axios from 'axios';
import { appConfig } from '../../config.js';
import {  NetworkType } from '../../types/common.js';
import { BitcoinFeeRate } from '../../types/bitcoin.js';

export class MempoolProvider {
    private baseUrl: string;

    constructor(network: NetworkType) {
        this.baseUrl = network === 'mainnet' ? appConfig.mempool.mainnet : appConfig.mempool.testnet;
    }

    async getFeeRates(): Promise<BitcoinFeeRate> {
        const res = await axios.get(`${this.baseUrl}/v1/fees/recommended`);
        return res.data;
    }
}
