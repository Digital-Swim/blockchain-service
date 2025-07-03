import { expect } from 'chai';
import { BitcoinAddress } from '../src/wallets/bitcoin/address.js';
import { BitcoinTransactionParams, NetworkType } from '../src/types/common.js';
import { BitcoinWallet } from '../src/wallets/bitcoin/wallet.js';
import { BitcoinRpcProvider } from '../src/providers/bitcoin/bitcoin-rpc.js';
import { BitcoinTransaction } from '../src/providers/bitcoin/utils/bitcoin-transaction.js';
import { error } from 'console';

const network: NetworkType = "regtest"
const rpc = new BitcoinRpcProvider({
    url: 'http://127.0.0.1:18443',
    username: 'ranjit',
    password: 'ranjit',
});

describe('BitcoinTransaction - regtest', function () {
    this.timeout(50000);

    const addressObject = new BitcoinAddress({ wif: "cNR3Ghixdw4QYfY4ZULKBF51kxVtD6EBCDTxBkHmunDTGCwnz8J8", network })
    let walletName = "test-rpc";
    let address = addressObject.getAddress('p2wpkh')
    let descriptor = addressObject.getDescriptor('p2wpkh')
    let toAddress = "";

    before(async () => {
        // Checking wallet, importing address to wallet 
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

        const { checksum } = await rpc.getDescriptorInfo(descriptor);
        const descWithChecksum = `${descriptor}#${checksum}`
        await rpc.importAddressToWallet(walletName, descWithChecksum, "test-address");

        toAddress = await rpc.getNewAddress(walletName, "test-ptr", 'bech32m') // taprrot??

        // Funding to have utxos and balacnce 
        await rpc.generateToAddress(101, address)
        await rpc.generateToAddress(101, toAddress)

        console.log(toAddress)

    });


    it('should create a valid regtest transaction', async () => {

        console.log(address);
        let bal = await rpc.getBalanceAddress(walletName, address);
        let utxos = await rpc.listUnspentAddress(walletName, address);

        //console.log(utxos);

        console.log(await rpc.getBalanceAddress(walletName, toAddress))

        const { hex, fee, outputs } = await BitcoinTransaction.create({
            amountSats: 100000,
            toAddress: toAddress,
            from: addressObject,
            utxos,
            feeRate: 1
        }, network)

        const a = await rpc.sendRawTransaction(hex);

        console.log(a, hex)


        await rpc.generateToAddress(1, addressObject.getAddress('p2wpkh'))

        console.log(await rpc.getBalanceAddress(walletName, toAddress))


    });


});
