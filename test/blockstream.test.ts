import { expect } from 'chai';
import { BlockstreamApiProvider } from '../src/providers/api/blockstream.js';
import { appConfig } from '../src/config.js';

describe('BlockstreamApiProvider', function () {
    this.timeout(10000);

    const provider = new BlockstreamApiProvider();

    it('should fetch the latest block hash', async () => {
        const hash = await provider.getLatestBlockHash();
        expect(hash).to.be.a('string').with.lengthOf(64);
    });

    it('should fetch block details by hash', async () => {
        const hash = await provider.getLatestBlockHash();
        const block = await provider.getBlockByHash(hash);
        expect(block).to.have.property('id').that.equals(hash);
    });

    it('should fetch transaction details', async () => {
        const txid = appConfig.network === "mainnet" ? "ad92e2eb89632a7325fa01c883a8c15451151e38f8e01af485982d1630308602" : "7b60810d0741bb960ff1294d7b3c8911fec387db42aca1f37b26bef321eebf28"
        const tx = await provider.getTransaction(txid);
        expect(tx).to.have.property('txid').that.equals(txid);
    });

    it('should fetch address info', async () => {
        const address = appConfig.network === "mainnet" ? "1PuJjnF476W3zXfVYmJfGnouzFDAXakkL4" : "tb1pnexuk5akmt54fj2n4qx4rhfmr0e5w6parza2kh7m0wgp3ejt2ajsgkcxqv";
        const info = await provider.getAddressInfo(address);
        expect(info).to.have.property('address').that.equals(address);
    });

    it('should fetch UTXOs for address', async () => {
        const address = appConfig.network === "mainnet" ? "1PuJjnF476W3zXfVYmJfGnouzFDAXakkL4" : "tb1pnexuk5akmt54fj2n4qx4rhfmr0e5w6parza2kh7m0wgp3ejt2ajsgkcxqv";
        const utxos = await provider.getAddressUtxos(address);
        expect(utxos).to.be.an('array');
    });

    it('should broadcast transaction (simulate failure)', async () => {
        try {
            const rawTx = 'deadbeef'; // invalid tx hex
            await provider.broadcastTransaction(rawTx);
            throw new Error('Should have failed');
        } catch (err: any) {
            expect(err.response?.status).to.equal(400);
        }
    });
});
