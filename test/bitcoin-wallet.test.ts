import { expect } from 'chai';
import * as bitcoin from 'bitcoinjs-lib';
import { BitcoinWallet } from '../src/wallets/bitcoin/wallet.js';
import { NetworkType } from '../src/types/common.js';
import { BitcoinAddress } from '../src/wallets/bitcoin/address.js';
import { verifyMessage } from '../src/utils/common.js';

const supportedNetworks: NetworkType[] = ['mainnet', 'testnet', 'regtest'];

const networks = {
    mainnet: bitcoin.networks.bitcoin,
    testnet: bitcoin.networks.testnet,
    regtest: bitcoin.networks.regtest
};

describe('BitcoinWallet across networks', () => {
    for (const networkName of supportedNetworks) {

        const network = networks[networkName as keyof typeof networks];

        describe(`Network: ${networkName}`, () => {
            let wallet: BitcoinWallet;
            let address: BitcoinAddress;

            before(() => {
                wallet = new BitcoinWallet(undefined, networkName); // auto-generates mnemonic
                address = wallet.getAddress(0); // index 0, change 0
            });

            it('should generate a valid WIF', () => {
                const wif = address.getPrivateKeyWIF();
                expect(wif).to.be.a('string');
                expect(wif.length).to.be.greaterThan(10);
            });

            it('should restore wallet from WIF and match address', () => {
                const wif = address.getPrivateKeyWIF();
                const restored = new BitcoinAddress({ key:{wif}, network });
                expect(restored.getAddress('p2wpkh')).to.equal(address.getAddress('p2wpkh'));
            });

            it('should generate valid addresses for all supported types', () => {
                const p2pkh = address.getAddress('p2pkh');
                const p2wpkh = address.getAddress('p2wpkh');
                const p2sh = address.getAddress('p2sh');
                const p2tr = address.getAddress('p2tr');

                expect(p2pkh).to.be.a('string');
                expect(p2wpkh).to.match(/^(bc1|tb1|bcrt1)/);
                expect(p2sh).to.be.a('string');
                expect(p2tr).to.match(/^(bc1p|tb1p|bcrt1p)/);
            });

            it('should sign and verify message successfully', () => {
                const addr = address.getAddress('p2pkh');
                const msg = `test message on ${networkName}`;
                const sig = address.signMessage(msg);
                const isValid = verifyMessage(msg, addr, sig, network);
                expect(isValid).to.be.true;
            });

            it('should fail verification with wrong address', () => {
                const other = new BitcoinAddress({ network });
                const msg = 'wrong verify';
                const sig = address.signMessage(msg);
                const isValid = verifyMessage(msg, other.getAddress('p2pkh'), sig, network);
                expect(isValid).to.be.false;
            });

            it('should throw on unsupported address type', () => {
                expect(() => address.getAddress('foo' as any)).to.throw('Unsupported address type');
            });
        });
    }
});
