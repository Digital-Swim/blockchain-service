import { expect } from 'chai';
import { getAddressType } from '../src/providers/utils/common.js';
import { NetworkType } from '../src/types/common.js';
import { BitcoinAddress } from '../src/wallets/bitcoin/address.js';

describe('BitcoinAddress getAddress and getAddressType round-trip', () => {
    const networkTypes: NetworkType[] = ['mainnet', 'testnet', 'regtest'];
    const addressTypes = ['p2pkh', 'p2sh', 'p2wpkh', 'p2tr'] as const;

    for (const network of networkTypes) {
        for (const type of addressTypes) {
            it(`should generate and detect a valid ${type} address on ${network}`, () => {
                const address = new BitcoinAddress({ network });
                const generatedAddress = address.getAddress(type);
                const detectedType = getAddressType(generatedAddress, network);

                console.log(`Network: ${network}, Type: ${type}, Address: ${generatedAddress}, Detected: ${detectedType}`);
                expect(detectedType).to.equal(type);
            });
        }
    }

    it('should throw for invalid address', () => {
        expect(() =>
            getAddressType('invalid_address', 'mainnet')
        ).to.throw('Unsupported or invalid Bitcoin address');
    });
});
