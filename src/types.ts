

export type NetworkType = 'mainnet' | 'testnet' | 'regtest';

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

export type Utxo = {
  txid: string;
  vout: number;
  value: number;
}

export type BitcoinFeeRate = {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee?: number;
  minimumFee?: number;
}
export interface IBitcoinApiProvider {
  getAddressUtxos(address: string): Promise<Utxo[]>;
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