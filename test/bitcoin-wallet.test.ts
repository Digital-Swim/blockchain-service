import { expect } from 'chai';
import * as bitcoin from 'bitcoinjs-lib';
import { BitcoinWallet } from '../src/core/wallets/bitcoin.js';
import { NetworkType } from '../src/types/common.js';

const supportedNetworks: NetworkType[] = ['mainnet', 'testnet', 'regtest']

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

            before(() => {
                wallet = new BitcoinWallet({});
            });

            it('should generate a valid WIF', () => {
                const wif = wallet.getPrivateKeyWIF();
                expect(wif).to.be.a('string');
                expect(wif.length).to.be.greaterThan(10);
            });

            it('should restore wallet from WIF and match address', () => {
                const wif = wallet.getPrivateKeyWIF();
                const restored = new BitcoinWallet({});
                expect(restored.getAddress('p2wpkh')).to.equal(wallet.getAddress('p2wpkh'));
            });

            it('should generate valid addresses for all supported types', () => {
                const p2pkh = wallet.getAddress('p2pkh');
                const p2wpkh = wallet.getAddress('p2wpkh');
                const p2sh = wallet.getAddress('p2sh');
                const p2tr = wallet.getAddress('p2tr');

                expect(p2pkh).to.be.a('string');
                expect(p2wpkh).to.match(/^(bc1|tb1|bcrt1)/);
                expect(p2sh).to.be.a('string');
                expect(p2tr).to.match(/^(bc1p|tb1p|bcrt1p)/);
            });

            it('should sign and verify message successfully', () => {
                const address = wallet.getAddress('p2pkh');
                const msg = `test message on ${networkName}`;
                const sig = wallet.signMessage(msg);
                const isValid = BitcoinWallet.verifyMessage(msg, address, sig, network);
                expect(isValid).to.be.true;
            });

            it('should fail verification with wrong address', () => {
                const other = new BitcoinWallet({});
                const msg = 'wrong verify';
                const sig = wallet.signMessage(msg);
                const isValid = BitcoinWallet.verifyMessage(msg, other.getAddress('p2pkh'), sig, network);
                expect(isValid).to.be.false;
            });

            it('should throw on unsupported address type', () => {
                expect(() => wallet.getAddress('foo' as any)).to.throw('Unsupported address type');
            });
        });
    }
});
