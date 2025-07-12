import { expect } from 'chai';
import { before, describe, it } from 'mocha';
import { appConfig } from '../config.js';
import { BitcoinRpcProvider } from '../providers/bitcoin/rpc/bitcoin-rpc.js';
const rpc = new BitcoinRpcProvider({
    url: 'http://127.0.0.1:18443',
    username: 'ranjit',
    password: 'ranjit',
});
describe('BitcoinRpcClient', function () {
    this.timeout(10000);
    let address;
    let walletName = "test-rpc";
    before(async () => {
        // Create a new address for testing
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
        address = await rpc.getNewAddress(walletName, "test-address");
    });
    it('should get blockchain info', async () => {
        const info = await rpc.getBlockchainInfo();
        expect(info).to.have.property('chain').that.equals(appConfig.network);
    });
    it('should send BTC to an address', async () => {
        const minerAddress = await rpc.getNewAddress(walletName, "test-address");
        await rpc.generateToAddress(101, minerAddress); // fund wallet
        const balanceBefore = await rpc.getBalance(walletName);
        const txid = await rpc.sendToAddress(address, 1, walletName);
        expect(txid).to.be.a('string').and.to.have.lengthOf(64);
        const balanceAfter = await rpc.getBalance(walletName);
        expect(balanceAfter).to.be.lessThan(balanceBefore);
        await rpc.generateToAddress(1, minerAddress); // Confirming tx to use the bal in later cases 
        expect(await rpc.getBalanceAddress(walletName, address)).to.be.equal(1); // Verify address balance 
    });
    it('should create, sign and send raw transaction', async () => {
        const utxos = await rpc.listUnspentAddress(walletName, address);
        const utxo = utxos.find((u) => u.value >= 0.1);
        if (!utxo)
            throw new Error('No UTXO found with enough balance');
        const fee = 0.00001;
        const amount = 0.009;
        const outputs = {};
        outputs[await rpc.getNewAddress(walletName)] = amount;
        outputs[address] = utxo.value - amount - fee;
        const rawTx = await rpc.createRawTransaction([{ txid: utxo.txId, vout: utxo.vout }], outputs);
        const signedTx = await rpc.signRawTransactionWithWallet(rawTx, walletName);
        expect(signedTx).to.have.property('hex');
        const txid = await rpc.sendRawTransaction(signedTx.hex);
        expect(txid).to.be.a('string').and.to.have.lengthOf(64);
        // Condfirming tx
        await rpc.generateToAddress(1, address);
        const rawTxChain = await rpc.getRawTransaction(txid);
        expect(rawTxChain).to.have.property('hex');
        expect(rawTxChain.confirmations).to.greaterThan(0);
    });
    it('should generate blocks to an address', async () => {
        const miningAddress = await rpc.getNewAddress(walletName);
        const blocks = await rpc.generateToAddress(3, miningAddress);
        expect(blocks).to.be.an('array').that.has.lengthOf(3);
    });
});
