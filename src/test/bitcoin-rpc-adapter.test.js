import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import { BitcoinRpcProvider } from '../providers/bitcoin/rpc/bitcoin-rpc.js';
import { BitcoinRpcAdapter } from '../providers/bitcoin/bitcoin-rpc-adapter.js';
const walletName = "test-rpc";
const rpc = new BitcoinRpcProvider({
    url: 'http://127.0.0.1:18443',
    username: 'ranjit',
    password: 'ranjit',
});
const adapter = new BitcoinRpcAdapter(rpc, walletName);
describe('BitcoinRpcAdapter (Integration)', function () {
    this.timeout(10000);
    let testAddress;
    before(async () => {
        try {
            await rpc.createWallet(walletName);
        }
        catch (e) {
            if (!e.message.includes('already exists'))
                throw e;
        }
        try {
            await rpc.loadWallet(walletName);
        }
        catch (e) {
            if (!e.message.includes('already loaded'))
                throw e;
        }
        testAddress = await rpc.getNewAddress(walletName, "adapter-test");
        await rpc.generateToAddress(101, testAddress);
    });
    it('should get blockchain info', async () => {
        const info = await adapter.getBlockchainInfo();
        expect(info.chain).to.equal("regtest");
    });
    it('should get latest block hash', async () => {
        const hash = await adapter.getLatestBlockHash();
        expect(hash).to.be.a('string').with.lengthOf(64);
    });
    it('should get block at height', async () => {
        const block = await adapter.getBlockAtHeight(0);
        expect(block).to.be.an('array').with.lengthOf(1);
        expect(block[0]).to.have.property('hash');
    });
    it('should get block by hash', async () => {
        const hash = await adapter.getLatestBlockHash();
        const block = await adapter.getBlockByHash(hash);
        expect(block).to.have.property('height');
    });
    it('should get block transactions', async () => {
        const hash = await adapter.getLatestBlockHash();
        const txs = await adapter.getBlockTxs(hash);
        console.log(txs);
        expect(txs).to.be.an('array');
    });
    it('should get transaction by txid', async () => {
        const txid = await rpc.sendToAddress(testAddress, 0.01, walletName);
        await rpc.generateToAddress(1, testAddress);
        const tx = await adapter.getTransaction(txid);
        expect(tx.txid).to.equal(txid);
    });
    it('should get raw transaction hex', async () => {
        const txid = await rpc.sendToAddress(testAddress, 0.01, walletName);
        await rpc.generateToAddress(1, testAddress);
        const hex = await adapter.getTransactionHex(txid);
        expect(hex).to.be.a('string');
    });
    it('should broadcast transaction', async () => {
        // await rpc.sendToAddress(testAddress, 1, walletName);
        // await rpc.generateToAddress(1,testAddress);
        function toBTC(sats) {
            return Math.round(sats) / 1e8;
        }
        const utxos = await adapter.getAddressUtxos(testAddress);
        utxos.sort((a, b) => b.value - a.value);
        const fee = (1000); // in sats
        const amount = (10000); // in sats
        const target = (amount + fee + 37);
        let selectedUtxos = [];
        let inputTotal = 0;
        for (const utxo of utxos) {
            selectedUtxos.push({ txid: utxo.txId, vout: utxo.vout, value: toBTC(utxo.value) });
            inputTotal += (utxo.value);
            if (inputTotal >= (target))
                break;
        }
        if (inputTotal < target) {
            throw new Error("Not enough balance to cover amount + fee");
        }
        const outputs = {};
        const newAddress = "bcrt1qhzh5p9lpvtr9tf80ep4mjzakcymezml2ef4qdf"; // Or dynamically from rpc.getNewAddress()
        // Outputs
        outputs[newAddress] = toBTC(amount);
        // Send change back to self
        const change = toBTC(inputTotal - target);
        if (change > 0) {
            outputs[testAddress] = (change);
        }
        const rawTx = await rpc.createRawTransaction(selectedUtxos, outputs);
        const signedTx = await rpc.signRawTransactionWithWallet(rawTx, walletName);
        const txid = await adapter.broadcastTransaction(signedTx.hex);
        await rpc.generateToAddress(1, testAddress);
        expect(txid).to.be.a('string').with.lengthOf(64);
    });
    it('should return empty UTXOs (not implemented)', async () => {
        const utxos = await adapter.getAddressUtxos(testAddress);
        expect(utxos).to.be.an('array').that.is.not.empty;
    });
    it('should get mempool info', async () => {
        const mempool = await adapter.getMempoolInfo();
        expect(mempool).to.have.property('size');
    });
    it('should return empty from getAddressFull (unsupported)', async () => {
        const txs = await adapter.getAddressFull("");
        expect(txs).to.be.an('array').that.is.empty;
    });
});
