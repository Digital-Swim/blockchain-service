
import * as bitcoin from 'bitcoinjs-lib';
import { NetworkType } from '../../types/common';
import { BitcoinTransaction } from '../bitcoin/utils/bitcoin-transaction.js';


export class OrdinalProvider {

    protected network: bitcoin.networks.Network;

    constructor(network: NetworkType) {
        this.network = BitcoinTransaction.getNetwork(network)
    }



}


