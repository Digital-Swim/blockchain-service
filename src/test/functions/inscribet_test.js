import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
//import { PsbtInput, TapLeaf, TapLeafScript } from 'bip174';
import * as bitcoin from 'bitcoinjs-lib';
import { LEAF_VERSION_TAPSCRIPT, } from 'bitcoinjs-lib/payments/bip341.js';
import { toXOnly, } from 'bitcoinjs-lib/psbt/bip371.js';
import { randomBytes } from 'crypto';
import * as readline from 'readline';
import ECPairFactory from 'ecpair';
bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);
const rng = (size) => randomBytes(size);
const network = bitcoin.networks.regtest;
const ECPair = ECPairFactory(ecc);
async function createInscriptionTx() {
    // 1. Create keys
    const BIP32 = BIP32Factory(ecc);
    const internalKey = BIP32.fromSeed(randomBytes(64), network);
    const leafKey = BIP32.fromSeed(randomBytes(64), network);
    // 2. Define inscription script (simplified)
    // Example inscription script: just OP_FALSE OP_IF <data> OP_ENDIF
    const inscriptionScript = bitcoin.script.compile([
        bitcoin.opcodes.OP_FALSE,
        bitcoin.opcodes.OP_IF,
        Buffer.from('ord'), // Example: Ordinal tag
        Buffer.from('01', 'hex'), // Version
        Buffer.from('text/plain'), // MIME type
        Buffer.alloc(0), // Empty placeholder (could be file content)
        Buffer.from('Hello from Node.js inscription!'),
        bitcoin.opcodes.OP_ENDIF,
    ]);
    const leaf1 = { output: inscriptionScript };
    const redeem = {
        output: inscriptionScript,
        redeemVersion: LEAF_VERSION_TAPSCRIPT,
    };
    // 3. Build scriptTree for Taproot (single leaf)
    const scriptTree = leaf1;
    const internalPubkey = toXOnly(Buffer.from(internalKey.publicKey));
    // 4. Create P2TR output
    const { output: p2trOutput, witness, address } = bitcoin.payments.p2tr({
        internalPubkey,
        scriptTree,
        redeem,
        network,
    });
    if (!p2trOutput || !witness)
        throw new Error('Failed to create P2TR output');
    console.log(address);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    function questionAsync(query) {
        return new Promise(resolve => rl.question(query, resolve));
    }
    async function buildRevealTx() {
        try {
            const commitTxid = await questionAsync('Enter commit txid: ');
            const commitVoutStr = await questionAsync('Enter commit vout (output index): ');
            const commitValueStr = await questionAsync('Enter commit value (in sats): ');
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
            // 6. Build the reveal transaction spending from the commit UTXO
            const psbt = new bitcoin.Psbt({ network });
            psbt.addInput({
                hash: commitTxid,
                index: commitVout,
                sequence: 0xffffffff, // No CSV needed here, change if you want CSV behavior
                witnessUtxo: { value: (commitValue), script: p2trOutput },
            });
            // Add tapLeafScript info so PSBT knows which script path to use
            psbt.updateInput(0, {
                tapLeafScript: [
                    {
                        leafVersion: LEAF_VERSION_TAPSCRIPT,
                        script: inscriptionScript,
                        controlBlock: witness[witness.length - 1],
                    },
                ],
            });
            // 7. Add output sending all funds minus fee to another P2TR (or any address)
            // Let's just send back to internalKey P2TR address without scripts for simplicity
            const { address: sendAddress } = bitcoin.payments.p2tr({
                internalPubkey: toXOnly(Buffer.from(internalKey.publicKey)),
                network,
            });
            const fee = 1000;
            const sendAmount = commitValue - fee;
            psbt.addOutput({ address: sendAddress, value: (sendAmount) });
            // const signer = {
            //     publicKey: Buffer.from(leafKey.publicKey.slice(1, 33)), // x-only pubkey for Taproot, remove 0x02/0x03 prefix if needed
            //     sign: (hash: Buffer) => {
            //         return  Promise.resolve(ecc.signSchnorr(hash, Buffer.from(leafKey.privateKey!)))
            //         // sign schnorr signature on hash using leafKey.privateKey
            //         //return schnorr.sign(hash, leafKey.privateKey);
            //     }
            // };
            const signer = {
                publicKey: Buffer.from(leafKey.publicKey.slice(1, 33)), // x-only pubkey
                sign: async (hash) => {
                    const sig = ecc.signSchnorr(hash, Buffer.from(leafKey.privateKey));
                    return Buffer.from(sig);
                },
                signSchnorr: async (hash) => {
                    const sig = ecc.signSchnorr(hash, Buffer.from(leafKey.privateKey));
                    return Buffer.from(sig);
                },
            };
            // 8. Sign the input with the leafKey (script-path spend)
            await psbt.signInputAsync(0, signer);
            // 9. Finalize and extract transaction
            psbt.finalizeInput(0);
            const tx = psbt.extractTransaction();
            // 10. Broadcast the reveal transaction
            const hex = tx.toHex();
            console.log(hex);
        }
        catch (err) {
            console.error('Error:', err);
        }
        finally {
            rl.close();
        }
    }
    buildRevealTx();
}
// Working test 
async function createInscriptionTx2() {
    const BIP32 = BIP32Factory(ecc);
    const internalKey = BIP32.fromSeed(randomBytes(64), network);
    const leafKey = BIP32.fromSeed(randomBytes(64), network);
    const pubkey = toXOnly(Buffer.from(leafKey.publicKey));
    const leafScript = bitcoin.script.compile([
        pubkey,
        bitcoin.opcodes.OP_CHECKSIG,
        bitcoin.opcodes.OP_FALSE,
        bitcoin.opcodes.OP_IF,
        Buffer.from('ord'),
        Buffer.from('01', 'hex'),
        Buffer.from('text/plain'),
        Buffer.alloc(0),
        Buffer.from('Hello from Node.js inscription!'),
        bitcoin.opcodes.OP_ENDIF,
    ]);
    const scriptTree = {
        output: leafScript,
    };
    const redeem = {
        output: leafScript,
        redeemVersion: LEAF_VERSION_TAPSCRIPT,
    };
    const { output, witness, address } = bitcoin.payments.p2tr({
        internalPubkey: toXOnly(Buffer.from(internalKey.publicKey)),
        scriptTree,
        redeem,
        network,
    });
    console.log(address);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    function questionAsync(query) {
        return new Promise(resolve => rl.question(query, resolve));
    }
    async function buildRevealTx() {
        try {
            const commitTxid = await questionAsync('Enter commit txid: ');
            const commitVoutStr = await questionAsync('Enter commit vout (output index): ');
            const commitValueStr = await questionAsync('Enter commit value (in sats): ');
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
            // 6. Build the reveal transaction spending from the commit UTXO
            const psbt = new bitcoin.Psbt({ network });
            psbt.addInput({
                hash: commitTxid,
                index: commitVout,
                //sequence: 0xffffffff, // No CSV needed here, change if you want CSV behavior
                witnessUtxo: { value: (commitValue), script: output },
            });
            // Add tapLeafScript info so PSBT knows which script path to use
            psbt.updateInput(0, {
                tapLeafScript: [
                    {
                        leafVersion: redeem.redeemVersion,
                        script: redeem.output,
                        controlBlock: witness[witness.length - 1],
                    },
                ],
            });
            // 7. Add output sending all funds minus fee to another P2TR (or any address)
            // Let's just send back to internalKey P2TR address without scripts for simplicity
            const { address: sendAddress } = bitcoin.payments.p2tr({
                internalPubkey: toXOnly(Buffer.from(internalKey.publicKey)),
                network,
            });
            const fee = 1000;
            const sendAmount = commitValue - fee;
            psbt.addOutput({ address: sendAddress, value: (sendAmount) });
            // const signer = {
            //     publicKey: Buffer.from(leafKey.publicKey.slice(1, 33)), // x-only pubkey for Taproot, remove 0x02/0x03 prefix if needed
            //     sign: (hash: Buffer) => {
            //         return  Promise.resolve(ecc.signSchnorr(hash, Buffer.from(leafKey.privateKey!)))
            //         // sign schnorr signature on hash using leafKey.privateKey
            //         //return schnorr.sign(hash, leafKey.privateKey);
            //     }
            // };
            const leafSigner = {
                publicKey: Buffer.from(leafKey.publicKey),
                sign: (hash) => Buffer.from(leafKey.sign(hash)),
                signSchnorr: leafKey.signSchnorr
                    ? (hash) => Buffer.from(leafKey.signSchnorr(hash))
                    : undefined,
            };
            psbt.signInput(0, leafSigner);
            // 8. Sign the input with the leafKey (script-path spend)
            //await psbt.signInputAsync(0, signer);
            // 9. Finalize and extract transaction
            psbt.finalizeInput(0);
            const tx = psbt.extractTransaction();
            // 10. Broadcast the reveal transaction
            const hex = tx.toHex();
            console.log(hex);
        }
        catch (err) {
            console.error('Error:', err);
        }
        finally {
            rl.close();
        }
    }
    buildRevealTx();
}
async function createInscriptionTx3() {
    const wif = "cTgU4tVGog3cmC6xU2xG6BwMJntUWJj9Bt8GdxKaXDSxTTAVS5yE";
    const keypair = ECPair.fromWIF(wif, network);
    const pubkey = toXOnly(Buffer.from(keypair.publicKey));
    // const { address: sendAddress } = bitcoin.payments.p2tr({
    //     internalPubkey: pubkey,
    //     network,
    // });
    // console.log(sendAddress);
    const leafScript = bitcoin.script.compile([
        pubkey,
        bitcoin.opcodes.OP_CHECKSIG,
        bitcoin.opcodes.OP_FALSE,
        bitcoin.opcodes.OP_IF,
        Buffer.from('ord'),
        Buffer.from('01', 'hex'),
        Buffer.from('text/plain'),
        Buffer.alloc(0),
        Buffer.from('Hello from Node.js inscription!'),
        bitcoin.opcodes.OP_ENDIF,
    ]);
    const scriptTree = {
        output: leafScript,
    };
    const redeem = {
        output: leafScript,
        redeemVersion: LEAF_VERSION_TAPSCRIPT,
    };
    const { output, witness, address } = bitcoin.payments.p2tr({
        internalPubkey: pubkey,
        scriptTree,
        redeem,
        network,
    });
    console.log(address);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    function questionAsync(query) {
        return new Promise(resolve => rl.question(query, resolve));
    }
    async function buildRevealTx() {
        try {
            const commitTxid = await questionAsync('Enter commit txid: ');
            const commitVoutStr = await questionAsync('Enter commit vout (output index): ');
            const commitValueStr = await questionAsync('Enter commit value (in sats): ');
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
            // 6. Build the reveal transaction spending from the commit UTXO
            const psbt = new bitcoin.Psbt({ network });
            psbt.addInput({
                hash: commitTxid,
                index: commitVout,
                //sequence: 0xffffffff, // No CSV needed here, change if you want CSV behavior
                witnessUtxo: { value: (commitValue), script: output },
            });
            // Add tapLeafScript info so PSBT knows which script path to use
            psbt.updateInput(0, {
                tapLeafScript: [
                    {
                        leafVersion: redeem.redeemVersion,
                        script: redeem.output,
                        controlBlock: witness[witness.length - 1],
                    },
                ],
            });
            // 7. Add output sending all funds minus fee to another P2TR (or any address)
            // Let's just send back to internalKey P2TR address without scripts for simplicity
            const { address: sendAddress } = bitcoin.payments.p2tr({
                internalPubkey: pubkey,
                network,
            });
            const fee = 1000;
            const sendAmount = commitValue - fee;
            psbt.addOutput({ address: sendAddress, value: (sendAmount) });
            // const signer = {
            //     publicKey: Buffer.from(leafKey.publicKey.slice(1, 33)), // x-only pubkey for Taproot, remove 0x02/0x03 prefix if needed
            //     sign: (hash: Buffer) => {
            //         return  Promise.resolve(ecc.signSchnorr(hash, Buffer.from(leafKey.privateKey!)))
            //         // sign schnorr signature on hash using leafKey.privateKey
            //         //return schnorr.sign(hash, leafKey.privateKey);
            //     }
            // };
            const leafSigner = {
                publicKey: pubkey,
                sign: (hash) => Buffer.from(keypair.sign(hash)),
                signSchnorr: keypair.signSchnorr
                    ? (hash) => Buffer.from(keypair.signSchnorr(hash))
                    : undefined,
            };
            psbt.signInput(0, leafSigner);
            // 8. Sign the input with the leafKey (script-path spend)
            //await psbt.signInputAsync(0, signer);
            // 9. Finalize and extract transaction
            psbt.finalizeInput(0);
            const tx = psbt.extractTransaction();
            // 10. Broadcast the reveal transaction
            const hex = tx.toHex();
            console.log(hex);
        }
        catch (err) {
            console.error('Error:', err);
        }
        finally {
            rl.close();
        }
    }
    buildRevealTx();
}
async function transferTaprootUtxo() {
    // Your key WIF and get keypair + pubkey
    const wif = "cTgU4tVGog3cmC6xU2xG6BwMJntUWJj9Bt8GdxKaXDSxTTAVS5yE";
    const keypair = ECPair.fromWIF(wif, network);
    const pubkey = toXOnly(Buffer.from(keypair.publicKey));
    console.log(pubkey.toString('hex'));
    try {
        const utxo = {
            txid: "a356110f922356ec9f191de4e30d5cde4659ea5aa3a04cfcf4b4d0daa10ad28c",
            value: 9000,
            vout: 0,
            hex: "512062497f69e6b63aa4b057db330433863a2f829cd976b2aaf845893fc9cc5f34e7"
        };
        // For simplicity, send back to the same P2TR address (can replace here)
        const { address: sendAddress, output } = bitcoin.payments.p2tr({ internalPubkey: pubkey, network });
        const fee = 1000;
        const sendAmount = utxo.value - fee;
        const psbt = new bitcoin.Psbt({ network });
        // Taproot key path spend (no scriptTree, simple keyspend)
        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: output,
                value: utxo.value,
            },
            tapInternalKey: pubkey,
        });
        psbt.addOutput({
            address: sendAddress,
            value: sendAmount,
        });
        // Sign input with keypair (key spend)
        const leafSigner = {
            publicKey: pubkey,
            sign: (hash) => Buffer.from(keypair.sign(hash)),
            signSchnorr: keypair.signSchnorr
                ? (hash) => Buffer.from(keypair.signSchnorr(hash))
                : undefined,
        };
        psbt.signInput(0, leafSigner);
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        console.log('Raw transaction hex:\n', txHex);
    }
    catch (e) {
        console.error('Error:', e);
    }
    finally {
    }
}
transferTaprootUtxo();
