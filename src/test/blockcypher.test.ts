import { expect } from 'chai';

import { appConfig } from '../config.js';
import { BlockcypherApiProvider } from '../providers/bitcoin/api/blockcypher.js';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('BlockcypherApiProvider', function () {
    this.timeout(20000); // Increased timeout

    const network = appConfig.network === "regtest" ? "testnet" : appConfig.network;
    const provider = new BlockcypherApiProvider(network);

    it('should fetch the latest block hash', async () => {
        await delay(1000);
        const hash = await provider.getLatestBlockHash();
        expect(hash).to.be.a('string').with.lengthOf(64);
    });

    it('should fetch block details by hash', async () => {
        await delay(1000);
        const hash = await provider.getLatestBlockHash();
        const block = await provider.getBlockByHash(hash);
        expect(block).to.have.property('hash').that.equals(hash);
    });

    it('should fetch transaction details', async () => {
        await delay(1000);
        const txid = appConfig.network === "mainnet"
            ? "ad92e2eb89632a7325fa01c883a8c15451151e38f8e01af485982d1630308602"
            : "7b60810d0741bb960ff1294d7b3c8911fec387db42aca1f37b26bef321eebf28";
        const tx = await provider.getTransaction(txid);
        expect(tx).to.have.property('txid').that.equals(txid);
    });

    it('should fetch address info', async () => {
        await delay(1000);
        const address = appConfig.network === "mainnet"
            ? "1DEP8i3QJCsomS4BSMY2RpU1upv62aGvhD"
            : "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn";
        const info = await provider.getAddressInfo(address);
        expect(info).to.have.property('address').that.equals(address);
    });

    it('should fetch UTXOs for address', async () => {
        await delay(1000);
        const address = appConfig.network === "mainnet"
            ? "1DEP8i3QJCsomS4BSMY2RpU1upv62aGvhD"
            : "2Muvnve56oVZzs83t3FvdoASuh84Hqy9W9G";
        const utxos = await provider.getAddressUtxos(address);

        expect(utxos).to.be.an('array');
    });

    it('should broadcast transaction (simulate failure)', async () => {
        await delay(1000);
        const rawTx = 'deadbeef'; // invalid tx hex
        try {
            await provider.broadcastTransaction(rawTx);
            throw new Error('Expected broadcast to fail, but it succeeded');
        } catch (err: any) {
            expect(err).to.exist;
            expect(err.response?.status || err.status).to.be.oneOf([400, 422, 409]);
        }
    });

    it('should fetch full address transactions', async () => {
        await delay(1000);
        const address = network === "mainnet"
            ? "1DEP8i3QJCsomS4BSMY2RpU1upv62aGvhD"
            : "2Muvnve56oVZzs83t3FvdoASuh84Hqy9W9G";
        const txs = await provider.getAddressFull(address, 10);
        expect(txs).to.be.an('array');
        if (txs.length > 0) {
            expect(txs[0]).to.have.property('txid').that.is.a('string').with.lengthOf(64);
        }
    });

    it('should fetch mempool info', async () => {
        await delay(1000);
        const mempool = await provider.getMempoolInfo();
        expect(mempool).to.be.an('object');
        expect(mempool).to.have.property('count').that.is.a('number');
        expect(mempool).to.have.property('totalFee').that.is.a('number');
    });

    it('should fetch fee estimates', async () => {
        await delay(1000);
        const fees = await provider.getFeeEstimates();
        expect(fees).to.be.an('object');
        expect(fees).to.have.property('low').that.is.a('number');
        expect(fees).to.have.property('medium').that.is.a('number');
        expect(fees).to.have.property('high').that.is.a('number');
    });

    it('should fetch blocks at given height', async () => {
        const height = 800000;
        const blocks = await provider.getBlockAtHeight(height);
        expect(blocks).to.be.an('array').that.is.not.empty;
        const block = blocks[0];
        expect(block).to.have.property('hash').that.is.a('string').with.lengthOf(64);
        expect(block).to.have.property('height').that.equals(height);
    });

    it('should return the correct balance for a known Bitcoin address', async () => {
        const address = network === "mainnet"
            ? "1DEP8i3QJCsomS4BSMY2RpU1upv62aGvhD"
            : "2Muvnve56oVZzs83t3FvdoASuh84Hqy9W9G";
        const balance = await provider.getBalance(address);
        expect(balance).to.be.a('number');
        expect(balance).to.be.greaterThan(0);
    });

});
