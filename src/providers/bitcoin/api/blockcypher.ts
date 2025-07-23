import axios from 'axios';
import { appConfig } from '../../../config.js';
import {
    BitcoinAddressInfo,
    BitcoinBlock,
    BitcoinFeeEstimates,
    BitcoinMempoolInfo,
    BitcoinProvider,
    BitcoinTransaction,
    BitcoinTransactionStatus,
    BitcoinTxInput,
    BitcoinTxOutput,
    BitcoinTxStatus,
    BitcoinUtxo,
} from '../../../types/bitcoin.js';
import { NetworkType } from '../../../types/common.js';

export class BlockcypherApiProvider implements BitcoinProvider {
    baseUrl?: string;

    constructor(network: NetworkType) {
        this.baseUrl = network === 'mainnet'
            ? appConfig.blockcypher.mainnet
            : appConfig.blockcypher.testnet;
        console.log(this.baseUrl)
    }
   

    async getLatestBlockHash(): Promise<string> {
        const res = await axios.get(`${this.baseUrl}`);
        return res.data.hash;
    }

    async getLatestBlock(): Promise<BitcoinBlock> {
        const res = await axios.get(`${this.baseUrl}`);
        return {
            hash: res.data.hash,
            height: res.data.height,
            time: res.data.time,
            txCount: res.data.n_tx,
            prevHash: res.data.prev_block,
        };
    }

    async broadcastTransaction(rawTxHex: string): Promise<string> {
        const res = await axios.post(`${this.baseUrl}/txs/push`, { tx: rawTxHex });
        return res.data.tx.hash;
    }

    async getAddressUtxos(address: string, includePending: boolean = false): Promise<BitcoinUtxo[]> {

        const res = await axios.get(`${this.baseUrl}/addrs/${address}?unspentOnly=true`);

        const confirmed = res.data.txrefs || [];
        const unconfirmed = res.data.unconfirmed_txrefs || [];
        const allUtxos = [...confirmed, ...unconfirmed];

        return allUtxos
            .filter((utxo: any) => includePending || utxo.confirmations > 0)
            .map((utxo: any): BitcoinUtxo => ({
                txId: utxo.tx_hash,
                vout: utxo.tx_output_n,
                value: utxo.value,
                scriptPubKey: utxo.script || '',
                status: utxo.confirmations > 0 ? 'unspent' : 'pending',
                address: res.data.address,
                confirmations: utxo.confirmations
            } as BitcoinUtxo));

    }

    async getBlockchainInfo(): Promise<any> {
        const res = await axios.get(`${this.baseUrl}`);
        return res.data;
    }

    async getBlockAtHeight(height: number): Promise<BitcoinBlock[]> {
        const res = await axios.get(`${this.baseUrl}/blocks/${height}`);
        return [{
            hash: res.data.hash,
            height: res.data.height,
            time: res.data.time,
            txCount: res.data.n_tx,
            prevHash: res.data.prev_block,
        }];
    }

    async getBlockByHash(hash: string): Promise<BitcoinBlock> {
        const res = await axios.get(`${this.baseUrl}/blocks/${hash}`);
        return {
            hash: res.data.hash,
            height: res.data.height,
            time: res.data.time,
            txCount: res.data.n_tx,
            prevHash: res.data.prev_block,
        };
    }

    async getBlockTxs(hash: string, txStart = 0): Promise<string[]> {
        const res = await axios.get(`${this.baseUrl}/blocks/${hash}?txstart=${txStart}`);
        return res.data.txids || [];
    }

    async getTransaction(txid: string): Promise<BitcoinTransaction> {
        const res = await axios.get(`${this.baseUrl}/txs/${txid}`);
        const tx = res.data;
        const status: BitcoinTxStatus = {
            confirmed: tx.confirmations > 0,
            blockHeight: tx.block_height,
            blockHash: tx.block_hash,
            blockTime: tx.confirmed,
        };

        const vin: BitcoinTxInput[] = tx.inputs.map((input: any) => ({
            txid: input.prev_hash,
            vout: input.output_index,
            addresses: input.addresses,
            value: input.output_value,
        }));

        const vout: BitcoinTxOutput[] = tx.outputs.map((output: any, index: number) => ({
            value: output.value,
            n: index,
            scriptPubKey: output.script,
            addresses: output.addresses,
        }));

        return {
            txid: tx.hash,
            size: tx.size,
            weight: tx.weight,
            fee: tx.fees,
            confirmations: tx.confirmations,
            status,
            vin,
            vout,
        };
    }

    async getTransactionStatus(txid: string): Promise<BitcoinTransactionStatus> {
        try {
            const tx = await this.getTransaction(txid);

            if (tx?.status?.confirmed) {
                return 'confirmed';
            } else {
                return 'pending';
            }
        } catch {
            return 'failed';
        }
    }
    
    async getTransactionHex(txid: string): Promise<string> {
        const res = await axios.get(`${this.baseUrl}/txs/${txid}?includeHex=true`);
        return res.data.hex;
    }

    async getAddressInfo(address: string): Promise<BitcoinAddressInfo> {
        const res = await axios.get(`${this.baseUrl}/addrs/${address}`);
        return {
            address: res.data.address,
            balance: res.data.final_balance,
            totalReceived: res.data.total_received,
            totalSent: res.data.total_sent,
            txCount: res.data.n_tx,
        };
    }

    async getAddressFull(address: string, limit?: number, before?: string): Promise<BitcoinTransaction[]> {

        if (!limit) limit = 50;

        const params: Record<string, any> = { limit };
        if (before) params.before = before;

        const res = await axios.get(`${this.baseUrl}/addrs/${address}/full`, { params });

        if (res?.data?.txs)
            return (res.data.txs || []).map((tx: any): BitcoinTransaction => ({
                txid: tx.hash,
                size: tx.size,
                weight: tx.weight,
                fee: tx.fees,
                confirmations: tx.confirmations,
                status: {
                    confirmed: !!tx.confirmations,
                    blockHeight: tx.block_height,
                    blockHash: tx.block_hash,
                    blockTime: tx.confirmed,
                },
                vin: tx.inputs.map((input: any) => ({
                    txid: input.prev_hash,
                    vout: input.output_index,
                    addresses: input.addresses,
                    value: input.output_value,
                })),
                vout: tx.outputs.map((output: any) => ({
                    value: output.value,
                    n: output.output_index,
                    scriptPubKey: output.script,
                    addresses: output.addresses,
                })),
            }));

        return [];
    }

    async getMempoolInfo(): Promise<BitcoinMempoolInfo> {
        const res = await axios.get(`${this.baseUrl}/txs`);
        return {
            count: Array.isArray(res.data) ? res.data.length : 0,
            vsize: 0,        // Blockcypher doesn't provide these
            totalFee: 0,     // So leave as 0 or query from other API if needed
        };
    }

    async getFeeEstimates(): Promise<BitcoinFeeEstimates> {
        const res = await axios.get(`${this.baseUrl}`);
        return {
            low: res.data.low_fee_per_kb / 1000,
            medium: res.data.medium_fee_per_kb / 1000,
            high: res.data.high_fee_per_kb / 1000,
        };
    }

    async getBalance(address: string): Promise<number> {
        const res = await axios.get(`${this.baseUrl}/addrs/${address}/balance`);
        return res.data.final_balance; // balance is in satoshis
    }
}
