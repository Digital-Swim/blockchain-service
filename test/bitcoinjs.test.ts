import { expect } from 'chai';
import { BitcoinTransaction } from '../src/providers/bitcoin/utils/bitcoin-transaction.js';
import { IBitcoinApiProvider } from '../src/types/common.js';
import { appConfig } from '../src/config.js';
import { UTXO } from 'coinselect';
import { BitcoinWallet } from '../src/core/wallets/bitcoin.js';

const mockApiProvider: IBitcoinApiProvider = {
    async getAddressUtxos(address: string): Promise<UTXO[]> {
        return [
            {
                txId: 'a'.repeat(64),
                vout: 0,
                value: 10_000,
            },
        ];
    },
    async broadcastTransaction(rawTxHex: string): Promise<string> {
        return 'mock-txid';
    },
};

// const provider = new BitcoinTransaction(mockApiProvider, appConfig.network);

// describe('BitcoinProvider ' + appConfig.network, () => {

//     it('creates and signs a transaction', async () => {
//         const wallet = new BitcoinWallet({});
//         const utxos = await provider.fetchUtxos(wallet.getAddress());
//         const rawTx = await provider.create({
//             wallet,
//             toAddress: wallet.getAddress(),
//             amountSats: 5000,
//             utxos,
//             feeRate: 1
//         });
//         expect(typeof rawTx.hex).to.be.equal('string');
//         expect(rawTx.hex.length).to.be.greaterThan(12)
//     });

//     it('broadcasts a transaction (mocked)', async () => {
//         const txid = await provider.broadcastTransaction('deadbeef');
//         expect(txid).to.be.equal('mock-txid');
//     });

// });
