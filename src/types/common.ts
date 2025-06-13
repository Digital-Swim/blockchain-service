import { Target, UTXO } from "coinselect";
import { ECPairInterface } from "ecpair";


export type NetworkType = 'mainnet' | 'testnet' | 'regtest';
export type UtxoSelectStrategy = 'default' | 'accumulative' | 'blackjack' | 'break' | 'split';
export type BitcoinAddressType = 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2tr';


export type BitcoinCoreClientConfig = {
  headers?: Record<string, string>;
  host?: string;
  logger?: any;
  password?: string;
  timeout?: number;
  username?: string;
  version?: string;
  wallet?: string;
  allowDefaultWallet?: boolean;
}

export type NetworkUrls = {
  mainnet: string;
  testnet: string;
  regtest?: string;
}

export type ApiUrls = {
  base?: string
}

export type BlockstreamConfig = NetworkUrls & {}
export type MempoolConfig = NetworkUrls & {}
export type BitcoinjsConfig = {}
export type CoingeckoConfig = ApiUrls & {}

export type BitcoinFeeRate = {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee?: number;
  minimumFee?: number;
}

export type BitcoinTransactionParams = {
  keyPair: ECPairInterface;
  toAddress: string;
  amountSats: number;
  utxos?: UTXO[];
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

export interface IBitcoinApiProvider {
  getAddressUtxos(address: string): Promise<UTXO[]>;
  broadcastTransaction(rawTxHex: string): Promise<string>;
}

export interface AppConfig {
  network: NetworkType;
  bitcoinjs: BitcoinjsConfig;
  blockstream: BlockstreamConfig;
  bitcoinCore: BitcoinCoreClientConfig;
  mempool: MempoolConfig;
  coingecko: CoingeckoConfig;
}