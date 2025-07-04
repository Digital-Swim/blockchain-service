import { Target, UTXO } from "coinselect";
import { ECPairInterface } from "ecpair";
import { BitcoinAddress } from "../wallets/bitcoin/address";


export type NetworkType = 'mainnet' | 'testnet' | 'regtest';
export type UtxoSelectStrategy = 'default' | 'accumulative' | 'blackjack' | 'break' | 'split';
export type BitcoinAddressType = 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2tr';
export type BitcoinCoreAddressType = 'legacy' | 'p2sh-segwit' | 'bech32' | 'bech32m';


export interface RpcConfig {
  url: string;
  username: string;
  password: string;
}

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
export type BlockCypherConfig = NetworkUrls & {}
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
  from: BitcoinAddress;
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
  blockcypher: BlockCypherConfig;
}

export interface BitcoinApiProvider {
  getBlockchainInfo(): Promise<any>;

  getBlockAtHeight(height: number): Promise<any>;
  getBlockByHash(hash: string): Promise<any>;
  getBlockTxs(hash: string, txStart?: number): Promise<any>;

  getLatestBlockHash(): Promise<string>;

  getTransaction(txid: string): Promise<any>;
  getTransactionHex(txid: string): Promise<string>;
  broadcastTransaction(rawTxHex: string): Promise<any>;

  getAddressInfo(address: string): Promise<any>;
  getAddressFull?(address: string, limit?: number, before?: string): Promise<any>;
  getAddressUtxos(address: string): Promise<any[]>;

  getMempoolInfo?(): Promise<any>;
  getFeeEstimates?(): Promise<any>;
}
