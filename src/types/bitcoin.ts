import { Target } from "coinselect";
import { BitcoinAddress } from "../wallets/bitcoin/address";
import { NetworkType } from "./common";
import * as bitcoin from "bitcoinjs-lib";
export type UtxoSelectStrategy = 'default' | 'accumulative' | 'blackjack' | 'break' | 'split';
export type BitcoinAddressType = 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2tr' | 'p2wsh';
export type BitcoinCoreAddressType = 'legacy' | 'p2sh-segwit' | 'bech32' | 'bech32m';
export type BitcoinUtxoStatus = 'spent' | 'unspent' | 'pending';
export type BitcoinTransactionStatus = 'failed' | 'confirmed' | 'pending';

export interface UtxoManager {
    addUtxos(utxos: BitcoinUtxo[]): Promise<void>;
    getUnspentUtxos(address: string, fromNetwork?: boolean): Promise<BitcoinUtxo[]>;
    markUtxoAsSpent(txId: string, vout: number, spentInTxid: string): Promise<void>;
    getTotalBalance(address: string): Promise<number>;
    deleteUtxos(address: string): Promise<void>;
    reset(address: string): Promise<BitcoinUtxo[]>;
    udpateUtxos(txHex: string, status: BitcoinTransactionStatus, network: NetworkType | bitcoin.Network): Promise<void>;
}

export interface BitcoinProvider {
    baseUrl?: string;
    getBlockchainInfo(): Promise<any>; // Optional: Define a type later

    getLatestBlock(): Promise<BitcoinBlock>
    getBlockAtHeight(height: number): Promise<BitcoinBlock[]>;
    getBlockByHash(hash: string): Promise<BitcoinBlock>;
    getBlockTxs(hash: string, txStart?: number): Promise<string[]>;

    getLatestBlockHash(): Promise<string>;

    getTransaction(txid: string): Promise<BitcoinTransaction>;
    getTransactionHex(txid: string): Promise<string>;
    broadcastTransaction(rawTxHex: string): Promise<string>;

    getAddressInfo(address: string): Promise<BitcoinAddressInfo>;
    getAddressFull?(address: string, limit?: number, before?: string): Promise<BitcoinTransaction[]>;
    getAddressUtxos(address: string, includePending?: boolean): Promise<BitcoinUtxo[]>;

    getBalance(address: string): Promise<number>;
    getMempoolInfo?(): Promise<BitcoinMempoolInfo>;
    getFeeEstimates?(): Promise<BitcoinFeeEstimates>;
}

export type BitcoinKey = {
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
    scriptSig?: string;
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
    txId: string;
    vout: number;
    value: number;
    confirmations?: number;
    scriptPubKey?: string;
    status?: BitcoinUtxoStatus
    address?: string;
    spentInTxId?: string;
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
    utxos: BitcoinUtxo[];
    fixedFee?: number;
    feeRate?: number;
    utxoSelectStrategy?: UtxoSelectStrategy;
};

export type BitcoinTransactionResult = {
    hex: string;
    inputs: BitcoinUtxo[];
    outputs: Target[];
    fee: number;
};