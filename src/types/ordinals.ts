import { UTXO } from "coinselect"
import { BitcoinAddress } from "../wallets/bitcoin/address.js"

export type Inscription = {
    contentType: string,
    data: Buffer | string
}

export type CommitTrasanctionParams = {
    from: BitcoinAddress
    inscription: Inscription
}

export type RevelaTransactionParams = {
    from: BitcoinAddress,
    to: string,
    inscription: Inscription,
    commitUTXO: UTXO,
}
