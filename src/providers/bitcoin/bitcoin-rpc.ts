import { UTXO } from "coinselect";
import { Rpc } from "../utils/rpc.js";

export class BitcoinRpcProvider extends Rpc {

    private normalizeUTXO(raw: any): UTXO {
        return {
            txId: raw.txId ?? raw.txid,           // accept either `txId` or `txid`
            vout: raw.vout,
            value: raw.value ?? raw.amount,       // accept either `value` or `amount`
            address: raw.address
        };
    }

    getBlockchainInfo() {
        return this.call<any>('getblockchaininfo');
    }

    getDescriptorInfo(walletName: string, wif: string) {
        return this.call('getdescriptorinfo', [`wpkh(${wif})`], `/wallet/${walletName}`);
    }

    getNewAddress(walletName: string, label = '', addressType = 'bech32') {
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

    listUnspent(walletName: string): Promise<UTXO[]> {
        return new Promise((resolve, reject) => {
            this.call<any[]>('listunspent', [], `/wallet/${walletName}`)
                .then(rawUtxos => {
                    const normalized = rawUtxos.map(this.normalizeUTXO);
                    resolve(normalized);
                })
                .catch(err => reject(err));
        });
    }

    listUnspentAddress(walletName: string, address: string): Promise<UTXO[]> {
        return new Promise((resolve, reject) => {
            this.listUnspent(walletName).then((utxos: UTXO[]) => {
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
