import { BitcoinRpcProvider } from '../src/providers/bitcoin/rpc/bitcoin-rpc.js';
import { OrdinalProvider } from '../src/providers/ordinals/ordnials.js';
import { NetworkType } from '../src/types/common.js';
import { BitcoinAddress } from '../src/wallets/bitcoin/address.js';

const network: NetworkType = "regtest";
const rpc = new BitcoinRpcProvider({
    url: 'http://127.0.0.1:18443',
    username: 'ranjit',
    password: 'ranjit',
});

describe('BitcoinTransaction - regtest', function () {
    this.timeout(50000);

    const addressObject = new BitcoinAddress({
        key:{wif: "cNR3Ghixdw4QYfY4ZULKBF51kxVtD6EBCDTxBkHmunDTGCwnz8J8"},
        network
    });

    const walletName = "test-rpc";
    const fromAddress = addressObject.getAddress('p2wpkh');
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

        // const { checksum } = await rpc.getDescriptorInfo(fromDescriptor);
        // const descWithChecksum = `${fromDescriptor}#${checksum}`;
        // await rpc.importAddressToWallet(walletName, descWithChecksum, "test-address");

        toAddress = await rpc.getNewAddress(walletName, "test-to", 'bech32m');  // Taproot?

        console.log(toAddress)
        // expect(toAddress).to.be.a('string').that.includes('bcrt'); // Regtest address check

        // // Fund both addresses
        // await rpc.generateToAddress(101, fromAddress);
        // await rpc.generateToAddress(101, toAddress);

        // const fromBalance = await rpc.getBalanceAddress(walletName, fromAddress);
        // const toBalance = await rpc.getBalanceAddress(walletName, toAddress);
        // expect(fromBalance).to.be.above(0);
        // expect(toBalance).to.be.above(0);
    });

    it('should create an inscription ', async () => {

        let ord = new OrdinalProvider(network);

        let params = {
            from: addressObject,
            inscription: {
                contentType: 'text/plain',
                data: 'Every moment with you feels like a beautiful dream. Your smile brightens my darkest days, and your presence fills my heart with peace. I cherish you more than words can say. You are my forever, my always. Thank you for being the love of my life.'
            }
        }

        const utxo = await ord.commit(
            params
        );

        await rpc.generateToAddress(1, fromAddress);

        let c = await ord.reveal({
            commitUTXO: utxo,
            to: toAddress,
            from: addressObject,
            inscription: params.inscription
        })

        console.log(c);


    });
});
