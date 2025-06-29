import { expect } from 'chai';

import { appConfig } from '../src/config.js';
import { BitcoinWallet } from '../src/core/wallets/bitcoin.js';
import { IBitcoinApiProvider } from '../src/types/common.js';
import { OrdinalProvider } from '../src/providers/ordinals/ordnials.js';
import * as bitcoin from 'bitcoinjs-lib';

const mockApiProvider: IBitcoinApiProvider = {
    async getAddressUtxos(address: string) {
        return [{
            txId: 'a'.repeat(64),
            vout: 0,
            value: 10_000
        }];
    },
    async broadcastTransaction(rawTxHex: string) {
        return 'mock-txid';
    }
};

function reviveBuffers(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(reviveBuffers)
    } else if (obj && typeof obj === 'object') {
        if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
            return Buffer.from(obj.data)
        }
        const newObj: Record<string, any> = {}
        for (const key in obj) {
            newObj[key] = reviveBuffers(obj[key])
        }
        return newObj
    }
    return obj
}

describe('OrdinalProvider ' + appConfig.network, () => {

    const provider = new OrdinalProvider(mockApiProvider, appConfig.network);

    var t = `{"address":"bcrt1pf4druktlmdyxp3pfkk270hcm42gcx4tkh287tcv2mr4jjxvl3axq2ehl7v","seckey":"3f7a8f6dcce1dc90c24ebad6771a631b6e27b1a675b8650d52bec749e9adee33","tapleaf":"5f8b14423b09e1dfa396b686ff56812a18826e61d2dc6fc19a8636f4ff9f32a7","script":["55699dcafdf511b4ae7ac85e0261e5dd357a564557c2436144e75f515d2119aa","OP_CHECKSIG","OP_0","OP_IF",{"type":"Buffer","data":[111,114,100]},{"type":"Buffer","data":[1]},{"type":"Buffer","data":[116,101,120,116,47,112,108,97,105,110]},"OP_0",{"type":"Buffer","data":[72,101,108,108,111,44,32,66,105,116,99,111,105,110,32,79,114,100,105,110,97,108,115,32,102,114,111,109,32,71,101,109,105,110,105,33]},"OP_ENDIF"],"cblock":"c155699dcafdf511b4ae7ac85e0261e5dd357a564557c2436144e75f515d2119aa","pubkey":"55699dcafdf511b4ae7ac85e0261e5dd357a564557c2436144e75f515d2119aa"}
`
    const data = JSON.parse(`{"address":"bcrt1pf4druktlmdyxp3pfkk270hcm42gcx4tkh287tcv2mr4jjxvl3axq2ehl7v","seckey":"3f7a8f6dcce1dc90c24ebad6771a631b6e27b1a675b8650d52bec749e9adee33","tapleaf":"5f8b14423b09e1dfa396b686ff56812a18826e61d2dc6fc19a8636f4ff9f32a7","script":["55699dcafdf511b4ae7ac85e0261e5dd357a564557c2436144e75f515d2119aa","OP_CHECKSIG","OP_0","OP_IF",{"type":"Buffer","data":[111,114,100]},{"type":"Buffer","data":[1]},{"type":"Buffer","data":[116,101,120,116,47,112,108,97,105,110]},"OP_0",{"type":"Buffer","data":[72,101,108,108,111,44,32,66,105,116,99,111,105,110,32,79,114,100,105,110,97,108,115,32,102,114,111,109,32,71,101,109,105,110,105,33]},"OP_ENDIF"],"cblock":"c155699dcafdf511b4ae7ac85e0261e5dd357a564557c2436144e75f515d2119aa","pubkey":"55699dcafdf511b4ae7ac85e0261e5dd357a564557c2436144e75f515d2119aa"}`)

    it('creates inscription transactions', async () => {


        // const a = await provider.commitInscribe();
        // console.log(JSON.stringify(a))
        // console.log(a);
        // return

        let p = reviveBuffers(data);

        const params = {
            to: "bcrt1q2u05us4wvf30smcwelnqhrq06jj02seqpfq9hk",
            utxo: {
                txid: "1b803b600332980d06cc0ad642977dc43022b2f590aaf9f883289e4ab3dd0b6d",
                vout: 1,
                prevout: {
                    value: 1.00000000,
                    scriptPubKey: "51204d5a3e597fdb4860c429b595e7df1baa91835576ba8fe5e18ad8eb29199f8f4c",
                }
            },
            ...p
        }

        const b = await provider.revealInscribe(params);

        return

        const wallet = new BitcoinWallet({ network: bitcoin.networks.bitcoin });

        const utxos = await mockApiProvider.getAddressUtxos(wallet.getAddress());

        const inscription = {
            wallet,
            utxoTxId: utxos[0].txId,
            utxoVout: utxos[0].vout,
            utxoAmount: utxos[0].value,
            feeRate: 1,
            contentType: 'text/plain',
            inscriptionContent: 'Hello Ordinals!',
            recipientAddress: wallet.getAddress()
        };

        const result = await provider.createInscriptionTransactions(inscription);

        expect(result).to.have.property('commitTxHex');
        expect(result).to.have.property('revealTxHex');
        expect(result.commitTxHex).to.be.a('string').and.to.have.length.greaterThan(12);
        expect(result.revealTxHex).to.be.a('string').and.to.have.length.greaterThan(12);
    });

});
