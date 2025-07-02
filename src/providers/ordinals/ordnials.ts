
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { BitcoinTransaction } from '../bitcoin/utils/bitcoin-transaction.js';
import { IBitcoinApiProvider, NetworkType } from '../../types/common';
import { BitcoinWallet } from '../../core/wallets/bitcoin.js';
import { Psbt } from 'bitcoinjs-lib';
import { Tap, Address, Tx, Signer } from "@cmdcode/tapscript"
import { Buff } from "@cmdcode/buff-utils"
import * as bip32 from 'bip32';
import * as bip39 from 'bip39';
import { ECPairAPI } from "ecpair";
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371.js';
import { Taptree } from 'bitcoinjs-lib/src/types.js';

import fs from 'fs/promises'
import { URL } from 'url'
import { gen_seckey, get_pubkey, get_seckey } from '@cmdcode/crypto-tools/keys'
import { util } from '@cmdcode/crypto-tools';

const BIP32: bip32.BIP32API = bip32.BIP32Factory(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);

bitcoin.initEccLib(ecc);

export class OrdinalProvider {

    protected network: bitcoin.networks.Network;

    constructor(apiProvider: IBitcoinApiProvider, network: NetworkType) {
        this.network = BitcoinTransaction.getNetwork(network)
    }

    async createInscriptionTransactions(options: any) {
        const {
            wallet,
            utxoTxId,
            utxoVout,
            utxoAmount,
            feeRate,
            contentType,
            inscriptionContent,
            recipientAddress
        } = options;

        try {


            const walletFund = (wallet as BitcoinWallet)
            const keyPair = walletFund.getKeypair()
            const signableKey = walletFund.getSignableKey("p2tr");
            const internalPubkey = toXOnly(Buffer.from(keyPair.publicKey));
            // const tweakedSigner = internalPubkey.tweak(
            //     bitcoin.crypto.taggedHash('TapTweak', toXOnly(internalKey.publicKey)),
            // );

            // --- 1. Derive Keys and P2TR Address ---
            const leafVersion = 0xc0; // Tapscript leaf version (BIP342)


            // --- 2. Create Inscription Script (Ordinal 'envelope') ---
            // This is the core script that embeds the data according to the Ordinals protocol.
            // OP_FALSE OP_IF 'ord' OP_1 [content_type] OP_0 [content] OP_ENDIF
            const inscriptionScript = [
                bitcoin.script.OPS.OP_FALSE, // Starts an unexecuted conditional, making the data non-executable
                bitcoin.script.OPS.OP_IF,
                Buffer.from('ord', 'utf8'), // Ordinal protocol identifier
                bitcoin.script.OPS.OP_1,             // Tag for content type
                Buffer.from(contentType, 'utf8'), // The MIME type of the content
                bitcoin.script.OPS.OP_0,             // Tag for content body
                Buffer.from(inscriptionContent, 'utf8'), // The actual inscription data
                bitcoin.script.OPS.OP_ENDIF,         // Ends the unexecuted conditional
            ];

            const leafScript = bitcoin.script.compile(inscriptionScript)

            const redeem = {
                output: leafScript,
                redeemVersion: 0xc0,
            };

            // The script tree defines the Tapscript leaf that will contain our inscription
            const scriptTree: Taptree = {
                output: leafScript
            };

            const { address, output, witness } = bitcoin.payments.p2tr({
                internalPubkey,
                scriptTree,
                redeem,
                network: bitcoin.networks.bitcoin,
            });

            if (!address || !output || !witness) throw new Error('Invalid Taproot payment');

            // This object describes the specific Tapscript path for spending the inscription UTXO
            const tapLeafScript = {
                leafVersion: leafVersion,
                script: redeem.output,
                controlBlock: witness![witness!.length - 1] // This will be generated/validated by PSBT internally during finalization
            };

            // --- 3. Build Commit Transaction (Creates the Taproot output holding the inscription commitment) ---
            // This transaction sends the 546 sats to a Taproot address whose script path commits to the inscription.
            const commitPsbt = new Psbt({ network: this.network });

            // Input: Your existing UTXO
            commitPsbt.addInput({
                hash: utxoTxId,
                index: utxoVout,
                witnessUtxo: {
                    script: output!, // The scriptPubKey for the address owning the input UTXO
                    value: utxoAmount,
                },
                tapInternalKey: internalPubkey, // Important for P2TR inputs
            });

            commitPsbt.updateInput(0, {
                tapLeafScript: [
                    {
                        leafVersion: redeem.redeemVersion,
                        script: redeem.output,
                        controlBlock: witness[witness.length - 1],
                    },
                ],
            });

            // Output 1: The inscription output (dust limit for P2TR)
            const inscriptionOutputAmount = 546; // Standard Ordinals dust limit
            commitPsbt.addOutput({
                script: output!, // The scriptPubKey of the Taproot inscription address
                value: inscriptionOutputAmount,
            });

            // Calculate change output for the commit transaction
            // (Approximation for size, PSBT will refine during finalize)
            const dummyCommitTxSize = 150; // Estimate for a P2TR input + 2 outputs
            const commitFee = dummyCommitTxSize * feeRate;
            const changeAmount = utxoAmount - inscriptionOutputAmount - commitFee;

            if (changeAmount < 0) {
                throw new Error(`Commit transaction: Insufficient funds. Need ${Math.abs(changeAmount)} more sats.`);
            }
            if (changeAmount > 0 && changeAmount < 546) {
                // If change is dust, it's typically absorbed as extra fee or requires consolidation.
                // For simplicity, we'll throw an error to make user aware.
                throw new Error(`Commit transaction: Calculated change amount (${changeAmount} sats) is too low for a dust output. Adjust UTXO or fee rate.`);
            }

            if (changeAmount >= 546) { // Only add change if it's not dust
                // Send change back to your P2TR address
                commitPsbt.addOutput({
                    address: address!, // Re-use the same P2TR address for change, or derive a new one
                    value: changeAmount,
                });
            }

            console.log('Signing key publicKey:', signableKey.publicKey.toString('hex'));
            console.log('Internal pubkey:', internalPubkey.toString('hex'));

            // Sign the input of the commit transaction
            commitPsbt.signInput(0, signableKey);
            commitPsbt.finalizeAllInputs(); // Finalize the PSBT to get the raw transaction

            const commitTx = commitPsbt.extractTransaction();
            const commitTxHex = commitTx.toHex();

            // --- 4. Build Reveal Transaction (Spends the Taproot output, revealing inscription) ---
            // This transaction spends the 546 sat Taproot UTXO from the commit transaction.
            // The full inscription script is revealed in the witness data during this spend.
            const revealPsbt = new Psbt({ network: this.network });

            // Input: The inscription UTXO from the commit transaction
            const revealTxId = commitTx.getId(); // Get the TxID of the newly created commit transaction
            const revealVout = 0; // The inscription output is the first (index 0) output of the commit transaction
            const revealUtxoValue = inscriptionOutputAmount; // This value is 546 sats

            revealPsbt.addInput({
                hash: revealTxId,
                index: revealVout,
                witnessUtxo: {
                    script: output!, // The scriptPubKey of the P2TR address
                    value: revealUtxoValue,
                },
                // Crucial: Specify the tapLeafScript to reveal the inscription data
                tapLeafScript: [tapLeafScript],
                tapInternalKey: internalPubkey,
            });

            // Output 1: Send the inscribed satoshi to the recipient
            const inscribedRecipientValue = 546; // The actual value of the inscribed satoshi being sent
            revealPsbt.addOutput({
                address: recipientAddress,
                value: inscribedRecipientValue,
            });

            // Calculate fees for the reveal transaction
            // (This size will be significantly larger due to the inscription content in witness data)
            const dummyRevealTxSize = 250 + inscriptionContent.length; // Rough estimate (bytes of script + content)
            const revealFee = dummyRevealTxSize * feeRate;
            const revealChangeAmount = revealUtxoValue - inscribedRecipientValue - revealFee;

            if (revealChangeAmount < 0) {
                throw new Error(`Reveal transaction: Insufficient funds for fees. Need ${Math.abs(revealChangeAmount)} more sats.`);
            }
            if (revealChangeAmount > 0 && revealChangeAmount < 546) {
                // If change is dust, it will be absorbed by fees.
                // For simplicity, we'll throw an error to make user aware.
                throw new Error(`Reveal transaction: Calculated change amount (${revealChangeAmount} sats) is too low for a dust output. Will be absorbed into fees.`);
            }
            // Typically, for inscriptions, the reveal transaction will consume the entire 546 sats,
            // with the excess covering fees and 546 going to the recipient, resulting in 0 change.

            // Sign the input of the reveal transaction
            revealPsbt.signInput(0, signableKey);
            revealPsbt.finalizeAllInputs();

            const revealTx = revealPsbt.extractTransaction();
            const revealTxHex = revealTx.toHex();

            return { commitTxHex, revealTxHex };

        } catch (error: any) {
            console.error("Error creating inscription transactions:", error.message);
            throw error; // Re-throw to be handled by the caller
        }
    }

    // Helper function to convert a public key to its x-only form (needed for Taproot)
    toXOnly(pubKey: any) {
        if (pubKey.length === 33) {
            return pubKey.subarray(1, 33);
        }
        return pubKey;
    }


    // async inscribe() {
    //     // The 'marker' bytes. Part of the ordinal inscription format.
    //     const marker = Buff.encode('ord')
    //     /* Specify the media type of the file. Applications use this when rendering 
    //       * content. See: https://developer.mozilla.org/en-US/docs/Glossary/MIME_type 
    //       */
    //     const mimetype = Buff.encode('image/png')

    //     // Create a keypair to use for testing.
    //     const secret = '0a7d01d1c2e1592a02ea7671bb79ecd31d8d5e660b008f4b10e67787f4f24712'
    //     const seckey = new SecretKey(secret, { type: 'taproot' })
    //     const pubkey = seckey.pub


    //     // Basic format of an 'inscription' script.
    //     const script = [pubkey, 'OP_CHECKSIG', 'OP_0', 'OP_IF', marker, '01', mimetype, 'OP_0', imgdata, 'OP_ENDIF']

    //     // For tapscript spends, we need to convert this script into a 'tapleaf'.
    //     const tapleaf = Tap.encodeScript(script)

    //     // Generate a tapkey that includes our leaf script. Also, create a merlke proof 
    //     // (cblock) that targets our leaf and proves its inclusion in the tapkey.
    //     const [tpubkey, cblock] = Tap.getPubKey(pubkey, { target: tapleaf })


    //     // A taproot address is simply the tweaked public key, encoded in bech32 format.
    //     const address = Address.p2tr.fromPubKey(tpubkey, 'regtest')

    //     /* NOTE: To continue with this example, send 100_000 sats to the above address.
    //      * You will also need to make a note of the txid and vout of that transaction,
    //      * so that you can include that information below in the redeem tx.
    //      */

    //     const txdata = Tx.create({
    //         vin: [{
    //             // Use the txid of the funding transaction used to send the sats.
    //             txid: 'b8ed81aca92cd85458966de90bc0ab03409a321758c09e46090988b783459a4d',
    //             // Specify the index value of the output that you are going to spend from.
    //             vout: 0,
    //             // Also include the value and script of that ouput.
    //             prevout: {
    //                 // Feel free to change this if you sent a different amount.
    //                 value: 100_000,
    //                 // This is what our address looks like in script form.
    //                 scriptPubKey: ['OP_1', tpubkey]
    //             },
    //         }],
    //         vout: [{
    //             // We are leaving behind 1000 sats as a fee to the miners.
    //             value: 99_000,
    //             // This is the new script that we are locking our funds to.
    //             scriptPubKey: Address.toScriptPubKey('bcrt1q6zpf4gefu4ckuud3pjch563nm7x27u4ruahz3y')
    //         }]
    //     })

    //     // For this example, we are signing for input 0 of our transaction,
    //     // using the untweaked secret key. We are also extending the signature 
    //     // to include a commitment to the tapleaf script that we wish to use.
    //     const sig = Signer.taproot.sign(seckey, txdata, 0, { extension: tapleaf })

    //     // Add the signature to our witness data for input 0, along with the script
    //     // and merkle proof (cblock) for the script.
    //     txdata.vin[0].witness = [sig, script, cblock]

    //     // Check if the signature is valid for the provided public key, and that the
    //     // transaction is also valid (the merkle proof will be validated as well).
    //     const isValid = await Signer.taproot.verify(txdata, 0, { pubkey, throws: true })

    //     // You can publish your transaction data using 'sendrawtransaction' in Bitcoin Core, or you
    //     // can use an external API (such as https://mempool.space/docs/api/rest#post-transaction).
    // }


    params = {
        to: "bcrt1q2u05us4wvf30smcwelnqhrq06jj02seqpfq9hk",
        utxo: {
            txid: "5cf0284517754dab6fc077635b0f039fef6091e1d2b3b9b19673114e3d4a5246",
            vout: 1,
            prevout: {
                value: 1.00000000,
                scriptPubKey: "5120eb1721de5079613289c67508a29f1d9b970ae9f7cdbf1c771799ef5fab5006ec",
                scriptPubKey1: {
                    asm: "1 eb1721de5079613289c67508a29f1d9b970ae9f7cdbf1c771799ef5fab5006ec",
                    hex: "5120eb1721de5079613289c67508a29f1d9b970ae9f7cdbf1c771799ef5fab5006ec",
                    address: "bcrt1pavtjrhjs09sn9zwxw5y298canwts460hekl3cachn8h4l26sqmkq35rdf2",
                    type: "witness_v1_taproot"
                }
            }
        },
        address: 'bcrt1pavtjrhjs09sn9zwxw5y298canwts460hekl3cachn8h4l26sqmkq35rdf2',
        seckey: Buffer.from([
            140, 202, 139, 186, 231, 11, 181,
            221, 244, 30, 208, 18, 85, 170,
            101, 138, 52, 105, 211, 101, 88,
            50, 208, 67, 136, 81, 108, 113,
            164, 119, 228, 207
        ]),
        tapleaf: 'a647093d8fcba6025867920ebaabcb5c84aee5449601e46b52c8982b5736ab5d',
        script: [
            Buffer.from([
                235, 243, 247, 79, 251, 240, 154, 131,
                13, 170, 144, 144, 222, 27, 73, 60,
                36, 0, 50, 156, 90, 85, 254, 40,
                20, 126, 245, 45, 136, 118, 55, 192
            ]),
            'OP_CHECKSIG',
            'OP_0',
            'OP_IF',
            Buffer.from([111, 114, 100]),
            '01',
            Buffer.from('746578742f706c61696e', 'hex'), // "text/plain"
            'OP_0',
            Buffer.from('48656c6c6f2c20426974636f696e204f7264696e616c732066726f6d2047656d696e6921', 'hex'), // "Hello, Bitcoin Ordinals from Gemini!"
            'OP_ENDIF',
            'OP_0',
            Buffer.from('48656c6c6f2c20426974636f696e204f7264696e616c732066726f6d2047656d696e6921', 'hex'),
            'OP_ENDIF'
        ],

        cblock: 'c0ebf3f74ffbf09a830daa9090de1b493c2400329c5a55fe28147ef52d887637c0',

        pubkey: Buffer.from([
            235, 243, 247, 79, 251, 240, 154, 131,
            13, 170, 144, 144, 222, 27, 73, 60,
            36, 0, 50, 156, 90, 85, 254, 40,
            20, 126, 245, 45, 136, 118, 55, 192
        ])
    }


    async commitInscribe() {

        // const imgpath = new URL('./image.png', import.meta.url).pathname
        //const imgdata = await fs.readFile(imgpath).then(e => new Uint8Array(e))

        const inscriptionContent = Buffer.from('Hello, Bitcoin Ordinals from Gemini!')
        const contentType = Buffer.from('text/plain')
        const marker = Buffer.from('ord')
        const encodingByte = Buffer.from([0x01])

        // Step 2: Build the script

        /**
         * Specify a secret key to use for signing.
         */
        //    const secret = '0a7d01d1c2e1592a02ea7671bb79ecd31d8d5e660b008f4b10e67787f4f24712'
        //    const bytes = new TextEncoder().encode(secret);

        const seckey = gen_seckey()
        const pubkey = get_pubkey(seckey, true)

        // Basic format of an 'inscription' script.
        const script = [pubkey, 'OP_CHECKSIG', 'OP_0', 'OP_IF', marker, encodingByte, contentType, 'OP_0', inscriptionContent, 'OP_ENDIF']

        // For tapscript spends, we need to convert this script into a 'tapleaf'.
        const tapleaf = Tap.encodeScript(script)

        // Generate a tapkey that includes our leaf script. Also, create a merlke proof 
        // (cblock) that targets our leaf and proves its inclusion in the tapkey.
        const [tpubkey, cblock] = Tap.getPubKey(pubkey, { target: tapleaf })

        // A taproot address is simply the tweaked public key, encoded in bech32 format.
        const address = Address.p2tr.fromPubKey(tpubkey, 'regtest')

        console.log('Your address:', address)

        /* NOTE: To continue with this example, send 100_000 sats to the above address.
        * You will also need to make a note of the txid and vout of that transaction,
        * so that you can include that information below in the redeem tx.
        */

        return { address, seckey, tapleaf, script, cblock, pubkey };

    }


    async revealInscribe(params: any) {

        const { to, address, utxo, seckey, tapleaf, script, cblock, pubkey } = params;

        // Generate a utxo for testing (using a local core client).
        //const utxo = await wallet.create_utxo(100_000, address)

        const txdata = Tx.create({
            vin: [{
                // Use the txid of the funding transaction used to send the sats.
                txid: utxo.txid,
                // Specify the index value of the output that you are going to spend from.
                vout: utxo.vout,
                // Also include the value and script of that ouput.
                prevout: utxo.prevout
            }],
            vout: [{
                // We are leaving behind 10_000 sats as a fee to the miners.
                value: 90_000,
                // This is the new script that we are locking our funds to.
                scriptPubKey: Address.toScriptPubKey(to)
            }]
        })

        // For this example, we are signing for input 0 of our transaction,
        // using the untweaked secret key. We are also extending the signature 
        // to include a commitment to the tapleaf script that we wish to use.
        const sig = Signer.taproot.sign(seckey, txdata, 0, { extension: tapleaf })

        // Add the signature to our witness data for input 0, along with the script
        // and merkle proof (cblock) for the script.
        txdata.vin[0].witness = [sig, script, cblock]

        // Check if the signature is valid for the provided public key, and that the
        // transaction is also valid (the merkle proof will be validated as well).
        const isValid = Signer.taproot.verify(txdata, 0, { pubkey, throws: true })

        //console.log(isValid)

        // Encode the final transaction as hex.
        const txhex: Buff = Tx.encode(txdata)

        console.log(txhex.hex)

        return txhex.hex;


    }
}


