import { Target, UTXO } from "coinselect";
import { BitcoinAddress } from "../wallets/bitcoin/address";

export type UtxoSelectStrategy = 'default' | 'accumulative' | 'blackjack' | 'break' | 'split';
export type BitcoinAddressType = 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2tr';
export type BitcoinCoreAddressType = 'legacy' | 'p2sh-segwit' | 'bech32' | 'bech32m';

export interface BitcoinApiProvider {
    getBlockchainInfo(): Promise<any>; // Optional: Define a type later

    getBlockAtHeight(height: number): Promise<BitcoinBlock[]>;
    getBlockByHash(hash: string): Promise<BitcoinBlock>;
    getBlockTxs(hash: string, txStart?: number): Promise<string[]>;

    getLatestBlockHash(): Promise<string>;

    getTransaction(txid: string): Promise<BitcoinTransaction>;
    getTransactionHex(txid: string): Promise<string>;
    broadcastTransaction(rawTxHex: string): Promise<string>;

    getAddressInfo(address: string): Promise<BitcoinAddressInfo>;
    getAddressFull?(address: string, limit?: number, before?: string): Promise<BitcoinTransaction[]>;
    getAddressUtxos(address: string): Promise<BitcoinUtxo[]>;

    getMempoolInfo?(): Promise<BitcoinMempoolInfo>;
    getFeeEstimates?(): Promise<BitcoinFeeEstimates>;
}

export type BitcoinKey = {
    type: BitcoinAddressType,
    wif?: string,
    privateKey?: string
}

export type BitcoinParams = {
    from: string,
    key: BitcoinKey,
    to: string;
    amountSats: number;
    fixedFee?: number;
    feeRate?: number;
    utxoSelectStrategy?: UtxoSelectStrategy;
};

export interface BitcoinBlock {
    hash: string;
    height: number;
    time: string;
    txCount: number;
    prevHash: string;
}

export interface BitcoinTxInput {
    txid: string;
    vout: number;
    addresses?: string[];
    value: number;
}

export interface BitcoinTxOutput {
    value: number;
    n: number;
    addresses?: string[];
    scriptPubKey: string;
}

export interface BitcoinTxStatus {
    confirmed: boolean;
    blockHeight?: number;
    blockHash?: string;
    blockTime?: string;
}

export interface BitcoinTransaction {
    txid: string;
    size: number;
    weight: number;
    fee: number;
    confirmations?: number;
    status?: BitcoinTxStatus;
    vin: BitcoinTxInput[];
    vout: BitcoinTxOutput[];
}

export interface BitcoinUtxo {
    txid: string;
    vout: number;
    value: number;
    confirmations: number;
    scriptPubKey: string;
    status?: BitcoinTxStatus
}

export interface BitcoinFeeEstimates {
    low: number;
    medium: number;
    high: number;
}

export interface BitcoinAddressInfo {
    address: string;
    balance: number;
    totalReceived?: number;
    totalSent?: number;
    txCount?: number;
}

export interface BitcoinMempoolInfo {
    count: number;
    vsize: number;
    totalFee: number;
}


export type BitcoinFeeRate = {
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee?: number;
    minimumFee?: number;
}

export type BitcoinTransactionParams = {
    from: BitcoinAddress | string;
    toAddress: string;
    amountSats: number;
    utxos: UTXO[];
    fixedFee?: number;
    feeRate?: number;
    utxoSelectStrategy?: UtxoSelectStrategy;
};

export type BitcoinTransactionResult = {
    hex: string;
    inputs: UTXO[];
    outputs: Target[];
    fee: number;
};