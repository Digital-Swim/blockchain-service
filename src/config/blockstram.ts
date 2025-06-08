import dotenv from 'dotenv';
dotenv.config();

export const blockstreamConfig = {
    network: process.env.BITCOIN_NETWORK || 'mainnet',
    urls: {
        mainnet: process.env.BLOCKSTREAM_MAINNET_URL || 'https://blockstream.info/api',
        testnet: process.env.BLOCKSTREAM_TESTNET_URL || 'https://blockstream.info/testnet/api',
    },
};
