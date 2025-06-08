import { Utxo } from "./utxo.js";

export interface IBitcoinApiProvider {
    getAddressUtxos(address: string): Promise<Utxo[]>;
    broadcastTransaction(rawTxHex: string): Promise<string>;
  }