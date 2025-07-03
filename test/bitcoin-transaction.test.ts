import { expect } from 'chai';
import { BitcoinAddress } from '../src/wallets/bitcoin/address.js';
import { BitcoinTransactionParams, NetworkType } from '../src/types/common.js';
import { BitcoinWallet } from '../src/wallets/bitcoin/wallet.js';

const network:NetworkType = "regtest"

describe('BitcoinTransaction - regtest', () => {
    it('should create a valid regtest transaction', async () => {
       
        const wallet = new BitcoinWallet(undefined, "regtest")

        let a = wallet.getAddress(0);

        


    });
});
