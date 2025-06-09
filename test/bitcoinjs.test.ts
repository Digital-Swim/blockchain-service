import { expect } from 'chai';
import { BitcoinjsProvider } from '../src/providers/bitcoin/bitcoinjs.js';
import { IBitcoinApiProvider, Utxo } from '../src/types.js';
import { appConfig } from '../src/config.js';

const mockApiProvider: IBitcoinApiProvider = {
    async getAddressUtxos(address: string): Promise<Utxo[]> {
        return [
            {
                txid: 'a'.repeat(64),
                vout: 0,
                value: 10_000,
            },
        ];
    },
    async broadcastTransaction(rawTxHex: string): Promise<string> {
        return 'mock-txid';
    },
};

const provider = new BitcoinjsProvider(mockApiProvider, appConfig.bitcoinjs);

describe('BitcoinProvider ' + appConfig.network, () => {

    it('generates mnemonic and derives address', () => {
        const mnemonic = provider.generateMnemonic();
        expect(mnemonic.split(' ').length).to.be.greaterThanOrEqual(12);

        const keyPair = provider.getKeyPairFromMnemonic(mnemonic);
        const address = provider.getAddressFromKeyPair(keyPair);

        const expectedPrefix = appConfig.network === 'mainnet'
            ? 'bc1'
            : appConfig.network === 'testnet'
                ? 'tb1'
                : 'bcrt1';

        expect(address.startsWith(expectedPrefix)).to.be.true;
    });

    it('creates and signs a transaction on regtest', async () => {
        const mnemonic = provider.generateMnemonic();
        const keyPair = provider.getKeyPairFromMnemonic(mnemonic);

        const address = provider.getAddressFromKeyPair(keyPair);
        const utxos = await provider.fetchUtxos(address);

        const toAddress = provider.getAddressFromKeyPair(keyPair); // for test, send to self
        const rawTx = await provider.createTransaction({
            keyPair,
            toAddress,
            amountSats: 5000,
            feeSats: 1000,
            utxos,
        });

        expect(typeof rawTx).to.be.equal('string');
        expect(rawTx.length).to.be.greaterThan(12)
    });

    it('broadcasts a transaction (mocked)', async () => {
        const txid = await provider.broadcastTransaction('deadbeef');
        expect(txid).to.be.equal('mock-txid');
    });
});
