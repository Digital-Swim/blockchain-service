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
    status?:BitcoinTxStatus
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
