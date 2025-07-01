const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const ECPairFactory = require('ecpair').ECPairFactory;
const crypto = require('crypto');
const tinysecp = require('tiny-secp256k1');
const readline = require('readline');
const ECPair = ECPairFactory(tinysecp);
bitcoin.initEccLib(ecc);

const BN = require('bn.js');
const { get_seckey, get_pubkey } = require('@cmdcode/crypto-tools/keys');

const SECP256K1_ORDER = new BN('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141', 'hex');

const network = bitcoin.networks.regtest;

const keyPair = ECPair.makeRandom({ network });
const internalPrivkey = keyPair.privateKey;
const internalPubkey = keyPair.publicKey.slice(1);




const leafScript = bitcoin.script.compile([
    internalPubkey,
    bitcoin.opcodes.OP_CHECKSIG,
    bitcoin.opcodes.OP_FALSE,
    bitcoin.opcodes.OP_IF,
    Buffer.from('ord'),
    Buffer.from('01', 'hex'),
    Buffer.from('text/plain'),
    Buffer.from(''),
    Buffer.from('Hello from Node.js!'),
    bitcoin.opcodes.OP_ENDIF,
]);

function taggedHash(tag, msg) {
    const tagHash = crypto.createHash('sha256').update(tag).digest();
    return crypto.createHash('sha256')
        .update(Buffer.concat([tagHash, tagHash, msg]))
        .digest();
}

function tapLeafHash(script) {
    const version = Buffer.from([0xc0]);
    const scriptLen = bitcoin.script.number.encode(script.length);
    return taggedHash('TapLeaf', Buffer.concat([version, scriptLen, script]));
}

const leafHash = tapLeafHash(leafScript);

const tweak = taggedHash('TapTweak', Buffer.concat([internalPubkey, leafHash]));
const tweaked = ecc.xOnlyPointAddTweak(internalPubkey, tweak);
if (!tweaked) throw new Error('Tweak failed');
const tweakedPubkey = Buffer.from(tweaked.xOnlyPubkey);

const p2tr = bitcoin.payments.p2tr({ pubkey: tweakedPubkey, network });
console.log('Taproot address (commit address):', p2tr.address);

// --- Now prompt user for commit tx inputs ---

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

        const psbt = new bitcoin.Psbt({ network });

        psbt.addInput({
            hash: commitTxid,
            index: commitVout,
            witnessUtxo: {
                script: p2tr.output,
                value: commitValue,
            },
            tapLeafScript: [{
                leafVersion: 0xc0,
                script: leafScript,
                controlBlock: createControlBlock(internalPubkey, leafHash),
            }],
        });

        const changeAddress = p2tr.address;
        psbt.addOutput({
            address: changeAddress,
            value: commitValue - 500, // fee
        });

        const parity = tweaked.parity;  // <--- add this

        console.log(parity);

        const tweakedPrivkey = getTweakedPrivateKey(internalPrivkey, tweak, parity)

        const tweakedKeyPair = ECPair.fromPrivateKey(tweakedPrivkey, { network });

        console.log('Tweaked pubkey:', tweakedKeyPair.publicKey.toString('hex'));
        console.log('Expected tweaked pubkey:', tweakedPubkey.toString('hex'));
        
        console.log('internalPrivkey:', internalPrivkey.toString('hex'));
        console.log('internalPubkey:', internalPubkey.toString('hex'));
        console.log('leafHash:', leafHash.toString('hex'));
        console.log('tweak:', tweak.toString('hex'));
        console.log('parity:', parity);
        console.log('tweakedPrivkey:', tweakedPrivkey.toString('hex'));
        console.log('controlBlock length:', createControlBlock(internalPubkey, leafHash).length);
        console.log('p2tr.output:', p2tr.output.toString('hex'));


        // Now sign with tweakedKeyPair, not keyPair
        psbt.signInput(0, tweakedKeyPair);
        //psbt.signInput(0, keyPair);
        psbt.finalizeInput(0);

        const revealTxHex = psbt.extractTransaction().toHex();
        console.log('\nReveal TX Hex:', revealTxHex);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        rl.close();
    }
}

function createControlBlock(internalPubkey, leafHash) {
    const leafVersion = Buffer.from([0xc0]);
    return Buffer.concat([
        leafVersion,
        internalPubkey,
    ]);
}

function getTweakedPrivateKey(internalPrivkey, tweak, parity) {
    let privkeyBN = new BN(internalPrivkey);
    const tweakBN = new BN(tweak);

    if (parity === 1) {
        privkeyBN = SECP256K1_ORDER.sub(privkeyBN);
    }

    const tweakedBN = privkeyBN.add(tweakBN).umod(SECP256K1_ORDER);

    if (tweakedBN.isZero()) {
        throw new Error('Invalid tweaked private key: zero value');
    }

    return tweakedBN.toArrayLike(Buffer, 'be', 32);
}

buildRevealTx();
