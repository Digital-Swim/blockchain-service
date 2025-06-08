import * as bitcoin from "bitcoinjs-lib"
import { ECPairAPI, ECPairFactory } from "ecpair"
import * as ecc from 'tiny-secp256k1';
import BitcoinProvider from "../src/providers/bitcoin/bitcoin-core.js";


// let bit = new BitcoinProvider({
//     username: "ranjit",
//     password: "ranjit",
//     host: "http://localhost:18443",
//     wallet:"test"

// });

// let a = await bit.createTransaction();

// console.log(a);

// let ecPair: ECPairAPI = ECPairFactory(ecc);
// let a = ecPair.makeRandom();
// let b = bitcoin.payments.p2pkh({ pubkey: Buffer.from(a.publicKey) })
// console.log(b);


// async function createOrdinalInscription({
//     privateKeyWIF,
//     utxoTxId,
//     utxoVout,
//     utxoAmount,
//     feeRate,
//     contentType,
//     inscriptionContent,
//     recipientAddress,
// }) {
//     try {
//         if (!privateKeyWIF || !utxoTxId || utxoVout === undefined || !utxoAmount || !feeRate || !contentType || !inscriptionContent || !recipientAddress) {
//             throw new Error('Missing required parameters');
//         }

//         if (utxoAmount < 1000) throw new Error('UTXO amount must be at least 1000 sats.');
//         if (feeRate < 1) throw new Error('Fee rate must be at least 1 sat/vB.');
//         let ecPair: ECPairAPI = ECPairFactory(ecc);
//         // 1. Derive Keys
//         const keyPair = ecPair.fromWIF(privateKeyWIF, bitcoin.networks.testnet);
//         const internalPubkey = keyPair.publicKey.slice(1); // remove first byte for internal pubkey
//         const p2tr = bitcoin.payments.p2tr({ Buffer.from(internalPubkey), network: bitcoin.networks.testnet });

//         // 2. Create Inscription Script (TapScript leaf)
//         const inscriptionScript = bitcoin.script.compile([
//             bitcoin.script.OPS.OP_FALSE,
//             bitcoin.script.OPS.OP_IF,
//             Buffer.from('ord', 'utf8'),
//             bitcoin.script.OPS.OP_1,
//             Buffer.from(contentType, 'utf8'),
//             bitcoin.script.OPS.OP_0,
//             Buffer.from(inscriptionContent, 'utf8'),
//             bitcoin.script.OPS.OP_ENDIF,
//         ]);

//         const tapLeaf = {
//             leafVersion: bitcoin.script.TAPSCRIPT_LEAF_VERSION,
//             script: inscriptionScript,
//         };

//         // 3. Build Commit Transaction
//         const commitPsbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

//         commitPsbt.addInput({
//             hash: utxoTxId,
//             index: utxoVout,
//             witnessUtxo: {
//                 script: p2tr.output!!,
//                 value: utxoAmount,
//             },
//             tapInternalKey: internalPubkey,
//         });

//         const inscriptionOutputAmount = 546; // dust limit (safe value)
//         commitPsbt.addOutput({
//             script: p2tr.output!!,
//             value: inscriptionOutputAmount,
//         });

//         // Calculate fees (rough estimate)
//         const dummyCommitTxSize = 150;
//         const commitFee = dummyCommitTxSize * feeRate;
//         const changeAmount = utxoAmount - inscriptionOutputAmount - commitFee;

//         if (changeAmount < 546 && changeAmount > 0) {
//             throw new Error(`Change amount ${changeAmount} is dust. Increase UTXO or reduce fee rate.`);
//         } else if (changeAmount < 0) {
//             throw new Error(`UTXO too small to cover outputs + fee. Missing ${-changeAmount} sats.`);
//         }

//         if (changeAmount >= 546) {
//             // Send change back to self
//             const p2trChange = bitcoin.payments.p2tr({ internalPubkey, network: bitcoin.networks.testnet });
//             commitPsbt.addOutput({
//                 address: p2trChange.address!!,
//                 value: changeAmount,
//             });
//         }

//         commitPsbt.signInput(0, keyPair);
//         commitPsbt.finalizeAllInputs();

//         const commitTx = commitPsbt.extractTransaction();
//         const commitTxHex = commitTx.toHex();

//         // 4. Build Reveal Transaction
//         const revealPsbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

//         revealPsbt.addInput({
//             hash: commitTx.getId(),
//             index: 0,
//             witnessUtxo: {
//                 script: p2tr.output!!,
//                 value: inscriptionOutputAmount,
//             },
//             tapLeafScript: [tapLeaf],
//             tapInternalKey: internalPubkey,
//         });

//         const inscriptionRecipientAmount = 546; // send inscribed satoshi
//         revealPsbt.addOutput({
//             address: recipientAddress,
//             value: inscriptionRecipientAmount,
//         });

//         const dummyRevealTxSize = 250 + inscriptionContent.length;
//         const revealFee = dummyRevealTxSize * feeRate;
//         const revealChangeAmount = inscriptionOutputAmount - inscriptionRecipientAmount - revealFee;

//         if (revealChangeAmount < 0) {
//             throw new Error(`Reveal tx fees too high, need additional ${-revealChangeAmount} sats.`);
//         }

//         if (revealChangeAmount >= 546) {
//             const p2trChange = bitcoin.payments.p2tr({ internalPubkey, network: bitcoin.networks.testnet });
//             revealPsbt.addOutput({
//                 address: p2trChange.address!!,
//                 value: revealChangeAmount,
//             });
//         }

//         revealPsbt.signInput(0, keyPair);
//         revealPsbt.finalizeAllInputs();

//         const revealTx = revealPsbt.extractTransaction();
//         const revealTxHex = revealTx.toHex();

//         return { commitTxHex, revealTxHex };
//     } catch (err: any) {
//         throw new Error(`Error creating inscription: ${err?.message}`);
//     }
// }

// // Example usage:
// (async () => {
//     try {
//         const { commitTxHex, revealTxHex } = await createOrdinalInscription({
//             privateKeyWIF: 'cV...your_wif_here...',    // Your WIF key (testnet)
//             utxoTxId: 'your_utxo_txid_here',
//             utxoVout: 1,
//             utxoAmount: 15000,
//             feeRate: 5,
//             contentType: 'text/plain',
//             inscriptionContent: 'Hello, Ordinals!',
//             recipientAddress: 'tb1...recipient_address...', // testnet address
//         });
//         console.log('Commit Tx Hex:', commitTxHex);
//         console.log('Reveal Tx Hex:', revealTxHex);
//     } catch (e) {
//         console.error(e);
//     }
// })();

