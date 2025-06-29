const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const ECPairFactory = require('ecpair').ECPairFactory;
const crypto = require('crypto');
const tinysecp = require('tiny-secp256k1');
const ECPair = ECPairFactory(tinysecp);
bitcoin.initEccLib(ecc);
// Network
const network = bitcoin.networks.regtest;

// Generate internal key (x-only pubkey)
const keyPair = ECPair.makeRandom({ network });

const internalPrivkey = keyPair.privateKey;
const internalPubkey = keyPair.publicKey.slice(1); // remove prefix 0x02/0x03

// Create Tapleaf script (for inscription)
const leafScript = bitcoin.script.compile([
    internalPubkey,
    bitcoin.opcodes.OP_CHECKSIG,
    bitcoin.opcodes.OP_FALSE,
    bitcoin.opcodes.OP_IF,
    Buffer.from('ord'),
    Buffer.from('01', 'hex'), // version
    Buffer.from('text/plain'),
    Buffer.from(''), // body separator
    Buffer.from('Hello from Node.js!'),
    bitcoin.opcodes.OP_ENDIF,
]);

// Tagged hash helper
function taggedHash(tag, msg) {
    const tagHash = crypto.createHash('sha256').update(tag).digest();
    return crypto.createHash('sha256')
        .update(Buffer.concat([tagHash, tagHash, msg]))
        .digest();
}

// Compute tapleaf hash
function tapLeafHash(script) {
    const version = Buffer.from([0xc0]);
    const scriptLen = bitcoin.script.number.encode(script.length);
    return taggedHash('TapLeaf', Buffer.concat([version, scriptLen, script]));
}

const leafHash = tapLeafHash(leafScript);

// Compute tweak and tweaked pubkey
const tweak = taggedHash('TapTweak', Buffer.concat([internalPubkey, leafHash]));
const tweaked = ecc.xOnlyPointAddTweak(internalPubkey, tweak);

if (!tweaked) throw new Error('Tweak failed');

const tweakedPubkey = Buffer.from(tweaked.xOnlyPubkey);

// Create P2TR payment
const p2tr = bitcoin.payments.p2tr({ pubkey: tweakedPubkey, network });

console.log('Taproot address (commit address):', p2tr.address);


// === Build Reveal Transaction ===
// Replace these with your real commit txid and output index
const commitTxid = 'your_commit_txid_here'; // commit tx from previous step
const commitVout = 0;                       // index of output to spend (the commit output)
const commitValue = 14000;                  // amount in sats locked in commit output

// Create PSBT for reveal tx
const psbt = new bitcoin.Psbt({ network });

// Add input: commit output to spend
psbt.addInput({
    hash: commitTxid,
    index: commitVout,
    witnessUtxo: {
        script: bitcoin.script.compile([
            0x51, // OP_1 for P2TR keypath (dummy placeholder)
        ]),
        // Actually, witnessUtxo script should be the P2TR output script:
        script: bitcoin.payments.p2tr({ pubkey: tweakedPubkey, network }).output,
        value: commitValue,
    },
    tapLeafScript: [{
        leafVersion: 0xc0,
        script: leafScript,
        controlBlock: createControlBlock(internalPubkey, leafHash),
    }],
});

// Add output: send funds back to your own address (or anywhere)
const changeAddress = p2tr.address;
psbt.addOutput({
    address: changeAddress,
    value: commitValue - 500, // subtract fee (~500 sats)
});

// Sign input with internal privkey
psbt.signInput(0, keyPair);

// Finalize inputs with custom finalize function for Taproot script path
psbt.finalizeInput(0);

// Extract final reveal tx hex
const revealTxHex = psbt.extractTransaction().toHex();

console.log('Reveal TX Hex:', revealTxHex);

// --- Helper: create control block ---
function createControlBlock(internalPubkey, leafHash) {
    // control block = 
    // [1-byte leaf version + internalPubkey (32 bytes)] + [merkle proof for tapleaf (empty here)]
    // Here no merkle branch because only 1 leaf
    const leafVersion = Buffer.from([0xc0]); // leaf version
    return Buffer.concat([
        leafVersion,
        internalPubkey,
    ]);
}


return;

