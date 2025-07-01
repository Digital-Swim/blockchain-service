const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const ECPairFactory = require('ecpair').ECPairFactory;
const crypto = require('crypto');

const ECPair = ECPairFactory(ecc);

const network = bitcoin.networks.testnet;

// secp256k1 curve order (BigInt)
const SECP256K1_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

// Your internal private key (32 bytes)
const internalPrivkey = Buffer.from([
    82, 18, 20, 56, 152, 92, 71, 33, 177, 147, 36, 145, 90, 34, 137, 6,
    198, 218, 45, 186, 24, 187, 171, 63, 219, 83, 84, 126, 217, 49, 98, 185,
]);

// Create internal keypair and get x-only pubkey (32 bytes)
const internalKeyPair = ECPair.fromPrivateKey(internalPrivkey);
const internalPubkey = internalKeyPair.publicKey.slice(1, 33); // drop 0x02/03 prefix

// Example tapscript leaf (replace with your actual leaf script)
//const leafScript = Buffer.from('5120f44b6d4a66a3ede603a04a93908f2146eb1058055129b6753cdde59cb65dabbf', 'hex');
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

// Taproot leaf version (default 0xc0)
const leafVersion = 0xc0;

// Tagged hash function per BIP340/BIP341
function taggedHash(tag, msg) {
    const tagHash = crypto.createHash('sha256').update(tag).digest();
    return crypto.createHash('sha256').update(Buffer.concat([tagHash, tagHash, msg])).digest();
}

// Compute TapLeaf hash: SHA256("TapLeaf") tagged hash of (leafVersion + varint(script length) + script)
function tapLeafHash(script) {
    const versionBuf = Buffer.from([leafVersion]);
    const scriptLen = Buffer.from([script.length]); // assuming length < 253, safe here
    return taggedHash('TapLeaf', Buffer.concat([versionBuf, scriptLen, script]));
}

// Leaf hash for tweaking
const leafHash = tapLeafHash(leafScript);

// Compute tweak: SHA256("TapTweak") tagged hash of internalPubkey || leafHash
const tweak = taggedHash('TapTweak', Buffer.concat([internalPubkey, leafHash]));

// Tweak internal pubkey point with tweak
const tweakedResult = ecc.xOnlyPointAddTweak(internalPubkey, tweak);
if (!tweakedResult) throw new Error('Failed to tweak public key');

const tweakedPubkey = tweakedResult.xOnlyPubkey;
const parity = tweakedResult.parity; // 0 or 1

// Construct control block = 1-byte (leafVersion + parity) + internalPubkey (32 bytes)
const controlBlock = Buffer.concat([Buffer.from([leafVersion + parity]), internalPubkey]);

// Function to tweak private key according to parity and tweak
function tweakPrivKey(privKey, tweak, parity) {
    let priv = BigInt('0x' + privKey.toString('hex'));
    let t = BigInt('0x' + tweak.toString('hex'));

    // If parity is 1, use the negation of the privkey mod n
    if (parity === 1) {
        priv = SECP256K1_ORDER - priv;
    }

    priv = (priv + t) % SECP256K1_ORDER;

    if (priv === 0n) throw new Error('Invalid tweaked private key');

    // Convert back to 32-byte Buffer
    let privHex = priv.toString(16).padStart(64, '0');
    return Buffer.from(privHex, 'hex');
}

const tweakedPrivkey = tweakPrivKey(internalPrivkey, tweak, parity);

// Verify tweaked private key matches tweaked pubkey (optional check)
const tweakedKeyPair = ECPair.fromPrivateKey(tweakedPrivkey);

const tweakedXOnlyPubkey = Buffer.from(tweakedKeyPair.publicKey).slice(1, 33);

if (!tweakedXOnlyPubkey.equals(Buffer.from(tweakedPubkey))) {
    throw new Error('Tweaked private key does not correspond to tweaked public key');
}


// Create p2tr payment from tweaked pubkey
const p2tr = bitcoin.payments.p2tr({ pubkey: tweakedPubkey, network });

// Now create your PSBT with your commit UTXO
const psbt = new bitcoin.Psbt({ network });

const commitTxid = "9c2b8d0dfd1d46d144982dd78f6626801569797423752a7cf76f123ca823a124";
const commitVout = 0;
const commitValue = 10000;

psbt.addInput({
    hash: commitTxid,
    index: commitVout,
    witnessUtxo: {
        script: p2tr.output,
        value: commitValue,
    },
    tapLeafScript: [{
        leafVersion,
        script: leafScript,
        controlBlock,
    }],
});

// Add outputs as needed...

// Sign input 0 with tweaked private key
psbt.signInput(0, ECPair.fromPrivateKey(tweakedPrivkey));

// Validate and finalize
psbt.validateSignaturesOfInput(0);
psbt.finalizeAllInputs();

console.log('Final transaction hex:', psbt.extractTransaction().toHex());
