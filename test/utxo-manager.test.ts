import { FallbackBitcoinProvider } from '../src/providers/bitcoin/fallback-provider.js';
import { BitcoinRpcProvider } from '../src/providers/bitcoin/rpc/bitcoin-rpc.js';
import { BitcoinTransactionManager } from '../src/providers/bitcoin/utils/bitcoin-transaction.js';
import { LocalUtxoManager } from '../src/providers/bitcoin/utils/utxo-manager.js';
import { decodeRawTransaction, getNetwork } from '../src/providers/utils/common.js';
import { BitcoinTransactionParams } from '../src/types/bitcoin.js';
import { BitcoinAddress } from '../src/wallets/bitcoin/address.js';

const rpc = new BitcoinRpcProvider({
    url: 'http://127.0.0.1:18443',
    username: 'ranjit',
    password: 'ranjit',
});

describe('LocalUtxoManager (regtest)', function () {
    this.timeout(100000);
    const walletName = 'test-rpc';
    const network = "regtest"
    const bitcoinProvider = new FallbackBitcoinProvider(network)
    const utxoManager = new LocalUtxoManager(bitcoinProvider);

    const addressObject = new BitcoinAddress({
        wif: 'cNR3Ghixdw4QYfY4ZULKBF51kxVtD6EBCDTxBkHmunDTGCwnz8J8',
        network,
    }, utxoManager);

    const type = "p2wpkh"
    const fromAddress = addressObject.getAddress(type);
    addressObject.address = fromAddress;
    const fromDescriptor = addressObject.getDescriptor(type);
    let toAddress = 'bcrt1pp00dvm9ja0wnwckherxmwhxwlt7e8fts0str2nnhnrn7sldznk5spp2rxu';

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
        //await rpc.generateToAddress(101, fromAddress);

    });

    it(`should create and send a valid regtest transaction for ${type}`, async () => {

        const utxoManager = addressObject.getUtxoManager();
        let utxos = await utxoManager.getUnspentUtxos()

        const { hex, fee, inputs, outputs } = await BitcoinTransactionManager.create({
            amountSats: 197265,
            toAddress: toAddress,
            from: addressObject,
            utxos,
            feeRate: 1,
        } as BitcoinTransactionParams, network);

        console.log("sending tx")
        await rpc.sendRawTransaction(hex);

        console.log("udaitn  utxo")

        await utxoManager.udpateUtxos(hex, "pending");
        await rpc.generateToAddress(1, fromAddress);
        await utxoManager.udpateUtxos(hex, "confirmed");

        // const hex = "02000000000101f8047cbc1a77ebd583d6443dae9782910d81a9fb9409c1bff164282f846e66690100000000ffffffff0291020300000000002251200bded66cb2ebdd3762d7c8cdb75ccefafd93a5707c16354e7798e7e87da29da9e3277c75000000001600143c35665d71acc43e841382dca2a02d25d3d7411d0247304402206350f21e5783a93e1b57b37b3f2751752f09a38e410c7526cec7604e9b05c22902206bd8f60857c7bd824db14cfeece570beffdcc6966d96ea29d411c86b69faf69f012103e22236e6394ec3f4e48142aa90552ae0b1b3b4209d6e84cfdab509e3704d11ad00000000"
        // await utxoManager.udpateUtxos(hex, "failed");


    });


});
