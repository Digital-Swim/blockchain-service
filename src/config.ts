import dotenv from 'dotenv'
import { AppConfig, NetworkType } from './types/common.js'

dotenv.config()

export const appConfig: AppConfig = {
    network: (process.env.BITCOIN_NETWORK as NetworkType) || 'regtest',
    bitcoinjs: {},
    bitcoinNodes: [
        {
            username: process.env.BITCOIN_USERNAME ?? 'ranjit',
            password: process.env.BITCOIN_PASSWORD ?? 'ranjit',
            url: process.env.BITCOIN_HOST ?? 'http://localhost:18443',
        }
    ],
    blockcypher: {
        mainnet: process.env.BLOCKCYPHER_MAINNET_URL || 'https://api.blockcypher.com/v1/btc/main',
        testnet: process.env.BLOCKCYPHER_TESTNET_URL || 'https://api.blockcypher.com/v1/btc/test3',
    },
    blockstream: {
        mainnet: process.env.BLOCKSTREAM_MAINNET_URL || 'https://blockstream.info/api',
        testnet: process.env.BLOCKSTREAM_TESTNET_URL || 'https://blockstream.info/testnet/api',
    },
    bitcoinCore: {
        username: process.env.BITCOIN_USERNAME ?? 'bitcoin',
        password: process.env.BITCOIN_PASSWORD ?? 'defaultPassword',
        host: process.env.BITCOIN_HOST ?? 'http://localhost:18443',
    },
    mempool: {
        mainnet: process.env.MEMPOOL_API_URL_MAINNET || 'https://mempool.space/api',
        testnet: process.env.MEMPOOL_API_URL_TESTNET || 'https://mempool.space/testnet/api',
    },
    coingecko: {
        base: process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3'
    },
    selectedProviders: ['bitcoinNodes', 'blockcypher', 'blockstream']
}