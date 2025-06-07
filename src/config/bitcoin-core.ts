import dotenv from 'dotenv'
dotenv.config()

export interface BitcoinCoreClientConfig {
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


export const bitcoinCoreClientConfig: BitcoinCoreClientConfig = {
    username: process.env.BITCOIN_USERNAME ?? 'bitcoin',
    password: process.env.BITCOIN_PASSWORD ?? 'defaultPassword',
    host: process.env.BITCOIN_HOST ?? 'http://localhost:18443',
}