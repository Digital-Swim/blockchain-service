import { BitcoinAddress } from "../wallets/bitcoin/address.js"
import { BitcoinKey, BitcoinParams, BitcoinUtxo } from "./bitcoin.js"

export type Inscription = {
    contentType: string,
    data: Buffer | string
}

export type CommitTransactionParams = Partial<BitcoinParams> & { from: string, key: BitcoinKey, amountSats: number, inscription: Inscription };
export type RevelaTransactionParams = BitcoinParams & { inscription: Inscription, commitUTXO: BitcoinUtxo, fixedFee: number }

