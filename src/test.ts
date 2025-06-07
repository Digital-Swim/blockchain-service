import * as bitcoin from "bitcoinjs-lib"
import { ECPairAPI, ECPairFactory } from "ecpair"
import * as ecc from 'tiny-secp256k1';
import BitcoinProvider from "./providers/bitcoin/bitcoin-core.js";


let bit = new BitcoinProvider({
    username: "ranjit",
    password: "ranjit",
    host: "http://localhost:18443",
    wallet:"test"

});

let a = await bit.createTransaction();



console.log(a);

let ecPair: ECPairAPI = ECPairFactory(ecc);
let a = ecPair.makeRandom();
let b = bitcoin.payments.p2pkh({ pubkey: Buffer.from(a.publicKey) })
console.log(b);


