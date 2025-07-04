import Client from 'bitcoin-core'
import { BitcoinCoreClientConfig } from '../../types/common.js';

export default class BitcoinProvider {
    private client: Client | any

    constructor(config: BitcoinCoreClientConfig) {
        this.client = new Client(config)
    }

}
