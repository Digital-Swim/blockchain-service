import axios from 'axios';
import { appConfig } from '../../config.js';
import {
    BitcoinBlock,
    BitcoinTransaction,
    BitcoinAddressInfo,
    BitcoinUtxo,
    BitcoinFeeEstimates,
    BitcoinMempoolInfo,
    BitcoinTxStatus,
    BitcoinTxOutput,
    BitcoinTxInput,
    BitcoinApiProvider
} from '../../types/bitcoin.js';

import {  NetworkType } from '../../types/common.js';

export class BlockstreamApiProvider implements BitcoinApiProvider {
    private baseUrl: string;

    constructor(network: NetworkType) {
        this.baseUrl =
            network === 'mainnet' ? appConfig.blockstream.mainnet : appConfig.blockstream.testnet;
        console.log(this.baseUrl)
    }

    async getLatestBlockHash(): Promise<string> {
        const res = await axios.get(`${this.baseUrl}/blocks/tip/hash`);
        return res.data;
    }

    async broadcastTransaction(rawTxHex: string): Promise<string> {
        const res = await axios.post(`${this.baseUrl}/tx`, rawTxHex, {
            headers: { 'Content-Type': 'text/plain' },
        });
        return res.data;
    }

    async getAddressUtxos(address: string, confirmedOnly = false): Promise<BitcoinUtxo[]> {
        const res = await axios.get(`${this.baseUrl}/address/${address}/utxo`);

        return res.data
            .filter((utxo: any) => !confirmedOnly || utxo.status.confirmed)
            .map((utxo: any) => ({
                txid: utxo.txid,
                vout: utxo.vout,
                value: utxo.value,
                scriptPubKey: '',
                status: {
                    confirmed: utxo.status.confirmed,
                    blockHeight: utxo.status.block_height,
                    blockHash: utxo.status.block_hash,
                    blockTime: utxo.status.block_time
                } as BitcoinTxStatus
            }));
    }

    async getBlockchainInfo(): Promise<any> {
        const res = await axios.get(`${this.baseUrl}/`);
        return res.data;
    }

    async getBlockAtHeight(height: number): Promise<BitcoinBlock[]> {
        const res = await axios.get(`${this.baseUrl}/blocks/${height}`);
        const rawBlocks = res.data;

        // Map each raw block object to BitcoinBlock interface
        return rawBlocks.map((block: any) => ({
            hash: block.id,
            height: block.height,
            time: new Date(block.timestamp * 1000).toISOString(),
            txCount: block.tx_count,
            prevHash: block.previousblockhash,
        }));
    }

    async getBlockByHash(blockHash: string): Promise<BitcoinBlock> {
        const res = await axios.get(`${this.baseUrl}/block/${blockHash}`);

        const data = res.data;
        return {
            hash: data.id,
            height: data.height,
            time: new Date(data.timestamp * 1000).toISOString(),
            txCount: data.tx_count,
            prevHash: data.previousblockhash,
        };
    }

    async getBlockTxs(blockHash: string, startIndex?: number): Promise<string[]> {
        const url = startIndex !== undefined
            ? `${this.baseUrl}/block/${blockHash}/txs/${startIndex}`
            : `${this.baseUrl}/block/${blockHash}/txs`;
        const res = await axios.get(url);
        return res.data.map((tx: any) => tx.txid);
    }

    async getLatestBlock(): Promise<BitcoinBlock> {
        const blockHash = await this.getLatestBlockHash();
        return this.getBlockByHash(blockHash);
    }

    async getTransaction(txid: string): Promise<BitcoinTransaction> {
        const res = await axios.get(`${this.baseUrl}/tx/${txid}`);
        const data = res.data;

        const vin: BitcoinTxInput[] = data.vin.map((input: any) => ({
            txid: input.txid,
            vout: input.vout,
            addresses: input.prevout?.scriptpubkey_address ? [input.prevout.scriptpubkey_address] : [],
            value: input.prevout?.value || 0,
        }));

        const vout: BitcoinTxOutput[] = data.vout.map((output: any, index: number) => ({
            value: output.value,
            n: index,
            addresses: output.scriptpubkey_address ? [output.scriptpubkey_address] : [],
            scriptPubKey: output.scriptpubkey,
        }));

        const status: BitcoinTxStatus = {
            confirmed: data.status.confirmed,
            blockHeight: data.status.block_height,
            blockHash: data.status.block_hash,
            blockTime: data.status.block_time ? new Date(data.status.block_time * 1000).toISOString() : undefined,
        };

        return {
            txid: data.txid,
            size: data.size,
            weight: data.weight,
            fee: data.fee,
            confirmations: data.status.confirmed ? (data.status.block_height ? data.status.block_height : undefined) : undefined,
            status,
            vin,
            vout,
        };
    }

    async getTransactionHex(txid: string): Promise<string> {
        const res = await axios.get(`${this.baseUrl}/tx/${txid}/hex`);
        return res.data;
    }

    async getAddressInfo(address: string): Promise<BitcoinAddressInfo> {
        const res = await axios.get(`${this.baseUrl}/address/${address}`);
        const data = res.data;

        const balance = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;

        return {
            address: data.address,
            balance,
            totalReceived: data.chain_stats.funded_txo_sum,
            totalSent: data.chain_stats.spent_txo_sum,
            txCount: data.chain_stats.tx_count,
        };
    }

    async getBalance(address: string): Promise<number> {
        const info = await this.getAddressInfo(address);
        return info.balance;
    }


    async getAddressFull(address: string, limit = 50): Promise<BitcoinTransaction[]> {
        const res = await axios.get(`${this.baseUrl}/address/${address}/txs?limit=${limit}`);
        return res.data.map((tx: any) => ({
            txid: tx.txid,
            size: tx.size,
            weight: tx.weight,
            fee: tx.fee,
            confirmations: tx.confirmations,
            status: {
                confirmed: tx.status.confirmed,
                blockHeight: tx.status.block_height,
                blockHash: tx.status.block_hash,
                blockTime: tx.status.block_time,
            },
            vin: tx.vin.map((input: any) => ({
                txid: input.txid,
                vout: input.vout,
                addresses: input.addresses,
                value: input.value,
            })),
            vout: tx.vout.map((output: any) => ({
                value: output.value,
                n: output.n,
                addresses: output.addresses,
                scriptPubKey: output.scriptPubKey,
            })),
        }));
    }

    async getMempoolInfo(): Promise<BitcoinMempoolInfo> {
        const res = await axios.get(`${this.baseUrl}/mempool`);
        return {
            count: res.data.count,
            vsize: res.data.vsize,
            totalFee: res.data.total_fee
        };
    }
    async getFeeEstimates(): Promise<BitcoinFeeEstimates> {
        const res = await axios.get(`${this.baseUrl}/fee-estimates`);
        return {
            low: res.data["100"] || 1,
            medium: res.data["3"] || 10,
            high: res.data["1"] || 50,
        };
    }
}
