import { expect } from 'chai';
import { BitcoinAddress } from '../src/wallets/bitcoin/address.js';
import { BitcoinTransactionParams, NetworkType } from '../src/types/common.js';
import { BitcoinRpcProvider } from '../src/providers/bitcoin/bitcoin-rpc.js';
import { BitcoinTransaction } from '../src/providers/bitcoin/utils/bitcoin-transaction.js';

const network: NetworkType = "regtest";
const rpc = new BitcoinRpcProvider({
    url: 'http://127.0.0.1:18443',
    username: 'ranjit',
    password: 'ranjit',
});

describe('BitcoinTransaction - regtest', function () {
    this.timeout(50000);

    const addressObject = new BitcoinAddress({
        wif: "cNR3Ghixdw4QYfY4ZULKBF51kxVtD6EBCDTxBkHmunDTGCwnz8J8",
        network
    });

    const walletName = "test-rpc";
    const fromAddress = addressObject.getAddress('p2wpkh');
    const fromDescriptor = addressObject.getDescriptor('p2wpkh');
    let toAddress = "";

    before(async () => {
        try {
            await rpc.createWallet(walletName);
        } catch (e: any) {
            if (!e.message.includes('already exists')) throw e;
        }

        try {
            await rpc.loadWallet(walletName);
        } catch (e: any) {
            if (!e.message.includes('already loaded')) throw e;
        }

        const { checksum } = await rpc.getDescriptorInfo(fromDescriptor);
        const descWithChecksum = `${fromDescriptor}#${checksum}`;
        await rpc.importAddressToWallet(walletName, descWithChecksum, "test-address");

        toAddress = await rpc.getNewAddress(walletName, "test-to", 'bech32m');
        expect(toAddress).to.be.a('string').that.includes('bcrt'); // Regtest address check

        // Fund both addresses
        await rpc.generateToAddress(101, fromAddress);
        await rpc.generateToAddress(101, toAddress);

        const fromBalance = await rpc.getBalanceAddress(walletName, fromAddress);
        const toBalance = await rpc.getBalanceAddress(walletName, toAddress);
        expect(fromBalance).to.be.above(0);
        expect(toBalance).to.be.above(0);
    });

    it('should create and send a valid regtest transaction', async () => {
        const utxos = await rpc.listUnspentAddress(walletName, fromAddress);
        expect(utxos).to.be.an('array').that.is.not.empty;

        const { hex, fee, outputs } = await BitcoinTransaction.create({
            amountSats: 100000,
            toAddress: toAddress,
            from: addressObject,
            utxos,
            feeRate: 1
        } as BitcoinTransactionParams, network);

        expect(hex).to.be.a('string').that.matches(/^[0-9a-f]+$/i);
        expect(fee).to.be.a('number').that.is.above(0);

        const txid = await rpc.sendRawTransaction(hex);
        expect(txid).to.be.a('string').that.has.lengthOf(64);

        await rpc.generateToAddress(1, fromAddress);

        const finalBalance = await rpc.getBalanceAddress(walletName, toAddress);
        expect(finalBalance).to.be.greaterThan(0.001); // Should be > 0.001 BTC (100000 sats)
    });
});
