import dotenv from 'dotenv'
import { BitcoinjsConfig } from '../types/bitcoinjs.js';
dotenv.config()

export const bitcoinjsConfig: BitcoinjsConfig = {
    network: process.env.BITCOIN_NETWORK || 'mainnet',
};
