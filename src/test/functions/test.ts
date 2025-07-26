import BIP32Factory, * as bip32 from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { BitcoinAddress } from '../../wallets/bitcoin/address.js';
import { verifyMessage } from '../../utils/common.js';

function test() {

  const a = {
        "message": "Login request at 2025-07-26T09:11:47.761Z1",
        "signature": "J8mflXj4nPWGucnDngpQk56EHENh1svQCX2hrhxkbtUSVDtPW8q4o9mYkjQfnMYbTT7jfFdSJE/ux5CksbgM0/A=",
        "address": "tb1q0s8u4f767h62wcvsguynmhysq3srefd273ljs4",
        "pubKey": "02e44c1037e0c81fd7f0c434cb1efcedb27b6cd90009582a19b42ca95386ac5937",
        "network": "testnet",
        "chain": "bitcoin",
        "messageHash": "TWjbU3tFMWgTv+kPUKOm7Q2qdfFaZ0Bkx7uB9ZALy50="
    }
   
   const r = verifyMessage(a.message,a.address,a.signature, 'testnet')

   console.log(r)
   return

    let addres = new BitcoinAddress({ key: { wif: "cNR3Ghixdw4QYfY4ZULKBF51kxVtD6EBCDTxBkHmunDTGCwnz8J8" }, network: "testnet" })

    console.log(addres.getAddress("p2wpkh"));
    console.log(addres.getPrivateKeyHex())
    console.log(addres.getPrivateKeyWIF())

    console.log(addres.getDescriptor("p2wpkh"))


    return

    // Required: initialize bitcoinjs-lib ECC (optional but good practice)
    bitcoin.initEccLib(ecc);

    // Create BIP32 instance with custom ECC
    const bip32 = BIP32Factory(ecc);

    // Testnet network config
    const testnet = bitcoin.networks.testnet;

    // Your raw private key (32 bytes)
    const keyHex = 'ffaf2cea82eb92b51e5f702a786c25af2ffbc26ae20c834778a169f2eefb9ac3';
    const keyBuffer = Buffer.from(keyHex, 'hex');

    // Dummy 32-byte chain code (for testing/development only)
    const dummyChainCode = Buffer.alloc(32, 0);

    // 🔧 Create a BIP32 node using raw private key
    const node = bip32.fromPrivateKey(keyBuffer, dummyChainCode, testnet);

    // Export as Base58 extended private key (tprv...)
    const tprv = node.toBase58();

    console.log('BIP32 master key (tprv):', tprv);


}




test()
