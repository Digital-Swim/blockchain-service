import { Rpc } from "../../../utils/rpc.js";
import { BitcoinCoreAddressType, BitcoinUtxo } from "../../../types/bitcoin.js";
import { RpcConfig } from "../../../types/common.js";

export class BitcoinRpcProvider extends Rpc {

    constructor(config: RpcConfig) {
        super(config)
    }

    private normalizeUTXO(raw: any): BitcoinUtxo {
        return {
            txId: raw.txId ?? raw.txid,
            vout: raw.vout,
            value: Math.round((raw.value ?? raw.amount) * 1e8), // Satoshis
            address: raw.address,
            scriptPubKey: raw.scriptPubKey,
            status: raw.confirmations > 0 ? 'unspent' : 'pending',
        } as BitcoinUtxo;
    }

    async getBlockByHash(blockHash: string): Promise<any> {
        return this.call('getblock', [blockHash]);
    }

    getBlockchainInfo() {
        return this.call<any>('getblockchaininfo');
    }

    getDescriptorInfo(discriptor: string) {
        return this.call('getdescriptorinfo', [discriptor]);
    }

    importAddressToWallet(walletName: string, discriptor: string, label?: string) {
        const params = [
            {
                "desc": discriptor,
                "timestamp": "now",
                "label": label,
                "keypool": true
            }
        ]
        return this.call('importdescriptors', [params], `/wallet/${walletName}`);
    }

    getNewAddress(walletName: string, label = '', addressType: BitcoinCoreAddressType = 'bech32') {
        return this.call('getnewaddress', [label, addressType], `/wallet/${walletName}`);
    }

    getBalance(walletName: string) {
        return this.call<number>('getbalance', [], `/wallet/${walletName}`);
    }

    getBalanceAddress(walletName: string, address: string): Promise<number> {
        return new Promise((resolve, reject) => {
            this.listUnspentAddress(walletName, address).then(utxos => {
                resolve(utxos.reduce((sum, utxo) => sum + (utxo.value || 0), 0));
            }).catch(err => reject(err));
        })
    }

    createWallet(walletName: string, disablePrivateKeys = false, blank = false) {
        return this.call('createwallet', [walletName, disablePrivateKeys, blank]);
    }

    loadWallet(walletName: string) {
        return this.call('loadwallet', [walletName]);
    }

    sendToAddress(address: string, amount: number, wallet?: string) {
        const path = wallet ? `/wallet/${wallet}` : '';
        return this.call('sendtoaddress', [address, amount], path);
    }

    listUnspent(walletName: string): Promise<BitcoinUtxo[]> {
        return new Promise((resolve, reject) => {
            this.call<any[]>('listunspent', [], `/wallet/${walletName}`)
                .then(rawUtxos => {
                    const normalized = rawUtxos.map(this.normalizeUTXO);
                    resolve(normalized);
                })
                .catch(err => reject(err));
        });
    }

    listUnspentAddress(walletName: string, address: string): Promise<BitcoinUtxo[]> {
        return new Promise((resolve, reject) => {
            this.listUnspent(walletName).then((utxos: BitcoinUtxo[]) => {
                return utxos.filter(utxo => utxo.address! == address)
            }).then(utxos => resolve(utxos)).catch(e => reject(e));
        })
    }

    generateToAddress(blocks: number, address: string) {
        return this.call('generatetoaddress', [blocks, address]);
    }

    getRawTransaction(txid: string, verbose = true) {
        return this.call('getrawtransaction', [txid, verbose ? 1 : 0]);
    }

    createRawTransaction(inputs: any[], outputs: any) {
        return this.call('createrawtransaction', [inputs, outputs]);
    }

    sendRawTransaction(signedTxHex: string) {
        return this.call('sendrawtransaction', [signedTxHex]);
    }

    signRawTransactionWithWallet(rawTxHex: string, walletName?: string) {
        return this.call('signrawtransactionwithwallet', [rawTxHex], `/wallet/${walletName}`);
    }

}
