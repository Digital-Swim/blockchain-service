export type NetworkType = 'mainnet' | 'testnet' | 'regtest';

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

export interface AppConfig {
  network: NetworkType;
  bitcoinjs: BitcoinjsConfig;
  blockstream: BlockstreamConfig;
  bitcoinCore: BitcoinCoreClientConfig;
  mempool: MempoolConfig;
  coingecko: CoingeckoConfig;
  blockcypher: BlockCypherConfig;
}


