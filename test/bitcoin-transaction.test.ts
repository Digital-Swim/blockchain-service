import { expect } from 'chai';
import { BitcoinAddress } from '../src/wallets/bitcoin/address.js';
import { NetworkType } from '../src/types/common.js';
import { BitcoinRpcProvider } from '../src/providers/bitcoin/rpc/bitcoin-rpc.js';
import { BitcoinTransactionManager } from '../src/providers/bitcoin/utils/bitcoin-transaction.js';
import { BitcoinAddressType, BitcoinTransactionParams } from '../src/types/bitcoin.js';
import { getAddressType } from '../src/utils/common.js';

const network: NetworkType = "regtest";

const rpc = new BitcoinRpcProvider({
    url: 'http://127.0.0.1:18443',
    username: 'ranjit',
    password: 'ranjit',
});

describe('BitcoinTransaction - regtest with all address types', function () {
    this.timeout(60000);

    const walletName = 'test-rpc';
    //TODO Test for other types, issue with importing other types to wallet to get utxos for transaction
    const addressTypes: BitcoinAddressType[] = ['p2wpkh'] as const;

    for (const type of addressTypes) {
        describe(`Transaction using address type: ${type}`, () => {
            
            const addressObject = new BitcoinAddress({
                key:{wif: 'cNR3Ghixdw4QYfY4ZULKBF51kxVtD6EBCDTxBkHmunDTGCwnz8J8'},
                network,
            });

            const fromAddress = addressObject.getAddress(type);
            // Set this address for transaction 
            addressObject.address = fromAddress;
            const fromDescriptor = addressObject.getDescriptor(type);
            let toAddress = 'bcrt1pp00dvm9ja0wnwckherxmwhxwlt7e8fts0str2nnhnrn7sldznk5spp2rxu';
            console.log(fromAddress, type, getAddressType(fromAddress, network))

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
                await rpc.importAddressToWallet(walletName, descWithChecksum, `from-${type}`);

                // toAddress = await rpc.getNewAddress(walletName, `to-${type}`, 'bech32m'); // Always get bech32m output
                // expect(toAddress).to.be.a('string').that.includes('bcrt');

                await rpc.generateToAddress(101, fromAddress);
                // await rpc.generateToAddress(101, toAddress);

                // const fromBalance = await rpc.getBalanceAddress(walletName, fromAddress);
                // const toBalance = await rpc.getBalanceAddress(walletName, toAddress);
                // expect(fromBalance).to.be.above(0);
                // expect(toBalance).to.be.above(0);
            });

            it(`should create and send a valid regtest transaction for ${type}`, async () => {

                const utxos = await rpc.listUnspentAddress(walletName, fromAddress);
                expect(utxos).to.be.an('array').that.is.not.empty;

                const { hex, fee } = await BitcoinTransactionManager.create({
                    amountSats: 100000,
                    toAddress: toAddress,
                    from: addressObject,
                    utxos,
                    feeRate: 1,
                } as BitcoinTransactionParams, network);

                expect(hex).to.be.a('string').that.matches(/^[0-9a-f]+$/i);
                expect(fee).to.be.a('number').that.is.above(0);

                const txid = await rpc.sendRawTransaction(hex);
                expect(txid).to.be.a('string').that.has.lengthOf(64);

                await rpc.generateToAddress(1, fromAddress);

                const finalBalance = await rpc.getBalanceAddress(walletName, toAddress);
                expect(finalBalance).to.be.greaterThan(0.001); // > 100k sats
            });

        });
    }
});
