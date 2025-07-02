import * as bitcoin from 'bitcoinjs-lib';
import * as bitcoinMessage from 'bitcoinjs-message';
import * as bip32 from 'bip32';
import { ECPairAPI, ECPairFactory, ECPairInterface } from "ecpair";
import * as ecc from 'tiny-secp256k1';
import * as readline from 'readline';

import {
    toXOnly,
} from 'bitcoinjs-lib/src/psbt/bip371.js';

import { Taptree } from 'bitcoinjs-lib/src/types.js';
import { Address, Signer, Tap, Tx, TxData } from '@cmdcode/tapscript';
import { get_pubkey, get_seckey } from '@cmdcode/crypto-tools/keys';

const BIP32: bip32.BIP32API = bip32.BIP32Factory(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

const network = bitcoin.networks.regtest


function test() {

    // const keypair = ECPair.makeRandom();
    // const seckey = keypair.privateKey
    // const pubkey = toXOnly(Buffer.from(keypair.publicKey))
    const secret = '0a7d01d1c2e1592a02ea7671bb79ecd31d8d5e660b008f4b10e67787f4f24712'
    const seckey = get_seckey(secret)
    const pubkey = get_pubkey(seckey, true)

    const script = [
        pubkey,
        bitcoin.opcodes.OP_CHECKSIG,
        bitcoin.opcodes.OP_FALSE,
        bitcoin.opcodes.OP_IF,
        Buffer.from('ord'),
        Buffer.from('01', 'hex'),
        Buffer.from('text/plain'),
        Buffer.from(''),
        Buffer.from('Hello from Node.js!'),
        bitcoin.opcodes.OP_ENDIF,
    ]

    const tapleaf = Tap.encodeScript(script)
    const [tpubkey, cblock] = Tap.getPubKey(pubkey, { target: tapleaf })
    const address = Address.p2tr.fromPubKey(tpubkey, 'regtest')

    console.log(address);


    // Commiting tx here 

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function questionAsync(query: any) {
        return new Promise(resolve => rl.question(query, resolve));
    }

    async function buildRevealTx() {
        try {
            const commitTxid = await questionAsync('Enter commit txid: ');
            const commitVoutStr: any = await questionAsync('Enter commit vout (output index): ');
            const commitValueStr: any = await questionAsync('Enter commit value (in sats): ');

            const commitVout = parseInt(commitVoutStr, 10);
            const commitValue = parseInt(commitValueStr, 10);

            if (!commitTxid || isNaN(commitVout) || isNaN(commitValue)) {
                console.error('Invalid input. Please enter valid txid, vout (number), and value (number).');
                rl.close();
                return;
            }

            console.log('\nBuilding reveal transaction with:');
            console.log('commitTxid:', commitTxid);
            console.log('commitVout:', commitVout);
            console.log('commitValue:', commitValue);


            const txdata = Tx.create({
                vin: [{
                    // Use the txid of the funding transaction used to send the sats.
                    txid: commitTxid as string,
                    // Specify the index value of the output that you are going to spend from.
                    vout: commitVout,
                    // Also include the value and script of that ouput.
                    prevout: {
                        // Feel free to change this if you sent a different amount.
                        value: commitValue,
                        // This is what our address looks like in script form.
                        scriptPubKey: ['OP_1', tpubkey]
                    },
                }],
                vout: [{
                    // We are leaving behind 1000 sats as a fee to the miners.
                    value: 9000,
                    // This is the new script that we are locking our funds to.
                    scriptPubKey: Address.toScriptPubKey('bcrt1q6zpf4gefu4ckuud3pjch563nm7x27u4ruahz3y')
                }]
            })

            // For this example, we are signing for input 0 of our transaction,
            // using the untweaked secret key. We are also extending the signature 
            // to include a commitment to the tapleaf script that we wish to use.
            const sig = Signer.taproot.sign(seckey!, txdata, 0, { extension: tapleaf })

            // Add the signature to our witness data for input 0, along with the script
            // and merkle proof (cblock) for the script.
            txdata.vin[0].witness = [sig, tapleaf, cblock]

            // Check if the signature is valid for the provided public key, and that the
            // transaction is also valid (the merkle proof will be validated as well).
            const isValid = await Signer.taproot.verify(txdata, 0, { pubkey, throws: true })

            console.log(isValid);

            const txhex = Tx.encode(txdata)

            console.log(txhex.hex);



        } catch (err) {
            console.error('Error:', err);
        } finally {
            rl.close();
        }
    }

    buildRevealTx();

}



test();
