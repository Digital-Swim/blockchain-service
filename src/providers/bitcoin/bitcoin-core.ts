import Client from 'bitcoin-core'
import { BitcoinCoreClientConfig } from '../../config/bitcoin-core'


//bcrt1qxuur0q92f9khlqm0n3rzgk5jv58q0xjct0gavr
//bcrt1qnpl3ukkjjzk33ldgrj6gqugerfqytt902k9frv

export default class BitcoinProvider {
    private client: Client | any

    constructor(config: BitcoinCoreClientConfig) {
        this.client = new Client(config)
    }

    async getNewAddress(label?: string): Promise<any> {
        const wallets = await this.client.listWallets();
        return wallets;
    }

    async createTransaction() {
        try {

            // 1. Get a new address to receive funds
            const toAddress = await this.client.getNewAddress();

            // 2. Optionally, list UTXOs (unspent outputs)
            const utxos = await this.client.listUnspent();
            console.log('Available UTXOs:', utxos);

            // 3. Create and send a transaction
            const txid = await this.client.sendToAddress("bcrt1qxuur0q92f9khlqm0n3rzgk5jv58q0xjct0gavr", 0.01); // amount in BTC
            console.log('Transaction ID:', txid);

            // 4. Optional: Get transaction details
            const tx = await this.client.getTransaction(txid);
            console.log('Transaction details:', tx);




        } catch (error) {
            console.error('Error:', error);
        }
    }

}
