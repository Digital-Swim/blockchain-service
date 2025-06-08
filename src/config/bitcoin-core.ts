import dotenv from 'dotenv'
import { BitcoinCoreClientConfig } from '../types/bitcoin-core'
dotenv.config()


export const bitcoinCoreClientConfig: BitcoinCoreClientConfig = {
    username: process.env.BITCOIN_USERNAME ?? 'bitcoin',
    password: process.env.BITCOIN_PASSWORD ?? 'defaultPassword',
    host: process.env.BITCOIN_HOST ?? 'http://localhost:18443',
}