// --- Conceptual RPC Client for Bitcoin Node Interactions ---
// In a real server-side application, you would use a library like 'node-bitcoin-rpc'
// or 'bitcoin-core' to connect to your Bitcoin Core node.
// This class simulates the necessary RPC calls for demonstration.
class BitcoinRpcClient {
    constructor() {
        this.utxos = {}; // {address: [{txid, vout, value, script_pubkey}]}
        this.nextBlockHeight = 100;
        this.network = null; // Will be set by the main function (e.g., bitcoin.networks.regtest)
    }

    // Simulate sending funds to an address (like a faucet)
    async faucet(address, amount) {
        const txid = require('crypto').createHash('sha256').update(`faucet_tx_${address}_${amount}_${Date.now()}`).digest('hex');
        // In a real scenario, you'd get the actual scriptPubKey for the address
        const dummyScript = `dummy_script_for_${address}`;
        const utxo = { txId: txid, vout: 0, value: amount, script: dummyScript };
        if (!this.utxos[address]) {
            this.utxos[address] = [];
        }
        this.utxos[address].push(utxo);
        console.log(`Simulated faucet: Sent ${amount} sats to ${address} (TxID: ${txid})`);
        return { txId: txid, outs: [utxo] };
    }

    // Simulate getting UTXOs for an address
    async getUtxos(address) {
        // In a real scenario, you'd use 'listunspent' RPC call
        console.log(`Simulated getUtxos for ${address}:`, this.utxos[address] || []);
        return this.utxos[address] || [];
    }

    // Simulate broadcasting a raw transaction
    async broadcast(txHex) {
        // In a real scenario, you'd use 'sendrawtransaction' RPC call
        const txid = require('crypto').createHash('sha256').update(txHex).digest('hex');
        console.log(`Simulated broadcast: TxID ${txid}`);
        return { txid: txid, success: true };
    }

    // Simulate mining blocks
    async mine(numBlocks, address) {
        // In a real scenario, you'd use 'generatetoaddress' RPC call
        this.nextBlockHeight += numBlocks;
        console.log(`Simulated mining ${numBlocks} blocks. New height: ${this.nextBlockHeight}`);
        // Optionally, update UTXOs here if mining generates new ones
    }

    // Simulate getting a specific transaction output's details
    async getTxOutput(txid, vout) {
        // This is a simplistic mock. In a real RPC client, you'd parse
        // the 'getrawtransaction' and 'decoderawtransaction' outputs.
        if (txid.startsWith("faucet_tx")) {
            return { value: 500000, script: Buffer.from("76a914", "hex") }; // Dummy P2PKH script prefix
        } else if (txid.startsWith("commit_tx")) {
            return { value: 498000, script: Buffer.from("5120cc8a4bc64d897bddc5fbc2f670f7a8ba0b386779106cf1223c6fc5d7cd6fc115", "hex") }; // Dummy P2TR script
        }
        return {};
    }
}

// Instantiate the conceptual RPC client
const rpcClient = new BitcoinRpcClient();

// --- Main Node.js Inscription Function ---
async function createInscriptionTransactions(params) {
    const {
        fundingWIF = 'cMv1S6n8h2z5r4x3e2d1c0b9a8s7d6f5g4h3j2k1l0m9n8b7v6c5x4z3y2u1t0r',
        initialFaucetAmount = 500_000, // satoshis
        inscriptionContent = "Hello from Node.js Inscription!",
        inscriptionContentType = "text/plain",
        commitTxFee = 2000, // satoshis
        revealTxFee = 10000, // satoshis
        changeAddress = "bcrt1q02j02m4z3k7m8r4x4e7m5l7h9p0q0r9c8d7f6e5a4b3c2d1e0f" // Example P2WPKH for change
    } = params;

    const outputLog = [];

    // Import necessary Bitcoin libraries (these would be `require` in a real Node.js environment)
    // We assume these are installed via npm (e.g., npm install bitcoinjs-lib ecpair tiny-secp256k1 bip39 bip32)
    const bitcoin = await import('bitcoinjs-lib');
    const { ECPairFactory } = await import('ecpair');
    const ecc = await import('tiny-secp256k1');
    const bip39 = await import('bip39');
    const bip32 = await import('bip32');

    // Initialize ECPair with the ECC library
    const ECPair = ECPairFactory(ecc);

    // Set the network (Regtest for simulation)
    const network = bitcoin.networks.regtest;
    rpcClient.network = network; // Inform the mock RPC client about the network

    // Helper function to convert a public key to its x-only form (needed for Taproot)
    function toXOnly(pubKey) {
        // Ensure the public key is compressed (33 bytes) before extracting x-only
        if (pubKey.length === 33) {
            return pubKey.subarray(1, 33);
        }
        // If it's already 32 bytes, assume it's x-only
        return pubKey;
    }

    try {
        outputLog.push("Starting inscription process (Node.js server-side)...");

        // --- 1. Setup Wallet with WIF (for funding the commit transaction) ---
        const fundingKeypair = ECPair.fromWIF(fundingWIF, network);
        // For P2WPKH, the address can be derived directly from the public key
        const fundingP2WPKH = bitcoin.payments.p2wpkh({ pubkey: fundingKeypair.publicKey, network: network });
        const actualFundingAddress = fundingP2WPKH.address;

        outputLog.push(`\nUsing WIF: ${fundingWIF}`);
        outputLog.push(`Funding Address (P2WPKH): ${actualFundingAddress}`);

        // --- 2. Fund a UTXO for the commit transaction (using simulator faucet) ---
        outputLog.push(`\nFunding address with ${initialFaucetAmount / 100_000_000} BTC via faucet...`);
        // The faucet conceptually sends to the address derived from our WIF
        await rpcClient.faucet(actualFundingAddress, initialFaucetAmount);

        // Get the UTXOs for the funding address from the conceptual node
        const utxos = await rpcClient.getUtxos(actualFundingAddress);
        if (utxos.length === 0) {
            throw new Error("Failed to get UTXOs for funding address after faucet simulation.");
        }
        const fundingUtxo = utxos[0]; // Assuming the first UTXO is sufficient for our example

        outputLog.push(`Funding UTXO (TxID: ${fundingUtxo.txId}, Vout: ${fundingUtxo.vout}, Value: ${fundingUtxo.value} sats)`);

        // --- 3. Generate keys for the inscription's internal key (for the Taproot output) ---
        // This key is independent of the funding key.
        const inscriptionMnemonic = bip39.generateMnemonic();
        const inscriptionSeed = await bip39.mnemonicToSeed(inscriptionMnemonic);
        const inscriptionRootKey = bip32.fromSeed(inscriptionSeed);

        // Derive an internal key for the Taproot address (BIP86 path for single-sig Taproot)
        const inscriptionChildNode = inscriptionRootKey.derivePath(`m/86'/0'/0'/0/0`);
        const inscriptionInternalPubkey = toXOnly(inscriptionChildNode.publicKey);

        // --- 4. Define the Inscription Content and Script ---
        const inscriptionData = Buffer.from(inscriptionContent, 'utf8');

        // Ordinals inscription script (OP_FALSE OP_IF OP_PUSH 'ord' OP_PUSH 1 OP_PUSH 'text/plain' OP_PUSH 0 OP_PUSH 'content' OP_ENDIF)
        // This is the "envelope" that contains the inscription data.
        const inscriptionScript = bitcoin.script.compile([
            inscriptionInternalPubkey, // The key for the key-path spend (also part of the script path for clarity)
            bitcoin.opcodes.OP_CHECKSIG, // Signature check for key-path or within script-path
            bitcoin.opcodes.OP_FALSE,    // Start of the Ordinals "envelope"
            bitcoin.opcodes.OP_IF,
            Buffer.from('ord'),          // 'ord' protocol identifier
            bitcoin.opcodes.OP_1,        // Tag for content type
            Buffer.from(inscriptionContentType), // MIME type (e.g., 'text/plain')
            bitcoin.opcodes.OP_0,        // Tag for actual content
            inscriptionData,             // The actual inscription data
            bitcoin.opcodes.OP_ENDIF     // End of the Ordinals "envelope"
        ]);

        // Define the Tapscript leaf for our inscription
        const inscriptionLeaf = {
            output: inscriptionScript,
            version: 0xC0, // Tapscript leaf version (0xC0 for unspendable, as used by Ordinals for data)
        };

        // --- 5. Create the Taproot (P2TR) output script for the commit transaction ---
        // This output will be where the funds for the inscription are sent.
        // The `scriptTree` parameter commits to the inscriptionLeaf.
        const { address: p2trAddress, output: p2trOutputScript, tapTree } = bitcoin.payments.p2tr({
            internalPubkey: inscriptionInternalPubkey,
            scriptTree: inscriptionLeaf, // This is a single leaf, so it effectively forms the tree
            network: network,
        });

        outputLog.push(`\nGenerated P2TR Address (Commitment Destination): ${p2trAddress}`);
        outputLog.push(`Generated P2TR Output Script (hex): ${p2trOutputScript.toString('hex')}`);
        outputLog.push(`Inscription Content: "${inscriptionContent}" (Type: ${inscriptionContentType})`);

        // --- 6. Build the Commit PSBT (Partially Signed Bitcoin Transaction) ---
        const sendAmountToP2TR = fundingUtxo.value - commitTxFee;
        if (sendAmountToP2TR <= 0) {
            throw new Error("Insufficient funds for commit transaction after fees.");
        }

        const commitPsbt = new bitcoin.Psbt({ network: network });

        // Add the input from our funded UTXO
        commitPsbt.addInput({
            hash: fundingUtxo.txId,
            index: fundingUtxo.vout,
            witnessUtxo: fundingP2WPKH.output ? { script: fundingP2WPKH.output, value: BigInt(fundingUtxo.value) } : undefined,
            // For P2WPKH, witnessUtxo is enough. For other types, might need redeemScript, script or nonWitnessUtxo
        });

        // Add the P2TR output (the inscription's destination UTXO)
        commitPsbt.addOutput({
            address: p2trAddress,
            value: BigInt(sendAmountToP2TR),
        });

        // Sign the input of the commit transaction using the funding WIF's keypair
        commitPsbt.signInput(0, fundingKeypair);
        commitPsbt.finalizeAllInputs(); // Finalize all inputs to get the full transaction

        const commitTx = commitPsbt.extractTransaction();
        const commitTxHex = commitTx.toHex();
        const commitTxId = commitTx.getId();

        outputLog.push(`\n--- Commit Transaction Details ---`);
        outputLog.push(`Commit Transaction ID: ${commitTxId}`);
        outputLog.push(`Commit Transaction Hex: ${commitTxHex}`);

        // --- 7. Broadcast the commit transaction ---
        outputLog.push(`\nBroadcasting commit transaction...`);
        const commitBroadcastResult = await rpcClient.broadcast(commitTxHex);
        outputLog.push(`Commit Broadcast Result: ${JSON.stringify(commitBroadcastResult)}`);
        outputLog.push(`Commit transaction successfully broadcast! Funds locked in P2TR UTXO.`);

        // Wait for the commit transaction to be mined (simulate block generation)
        outputLog.push(`\nSimulating block generation for commit transaction...`);
        await rpcClient.mine(1); // Mine 1 block to confirm the commit tx
        outputLog.push(`Commit transaction confirmed!`);

        // --- 8. Prepare for Reveal Transaction ---
        // The UTXO to spend in the reveal transaction is the output of the commit transaction.
        const commitUtxoForReveal = {
            txId: commitTxId,
            vout: 0, // Our P2TR output is typically the first output of the commit transaction
            value: sendAmountToP2TR,
            script: p2trOutputScript,
        };

        // Tweak the private key for the inscription's internal key.
        // This tweaked key is used to sign the reveal transaction via the script path.
        // `tapTree.merkleRoot` provides the necessary tweak factor.
        const tweakedChildNode = inscriptionChildNode.tweak(tapTree.merkleRoot);

        // --- 9. Build the Reveal PSBT ---
        const sendChangeAmount = commitUtxoForReveal.value - revealTxFee;
        if (sendChangeAmount < 546) { // Bitcoin dust limit for outputs (typically 546 sats for P2WPKH)
            throw new Error(`Change amount (${sendChangeAmount} sats) is below dust limit (546 sats). Increase initialFaucetAmount or reduce fees.`);
        }

        const revealPsbt = new bitcoin.Psbt({ network: network });

        // Add the P2TR input from the commit transaction
        revealPsbt.addInput({
            hash: commitUtxoForReveal.txId,
            index: commitUtxoForReveal.vout,
            witnessUtxo: {
                script: commitUtxoForReveal.script,
                value: BigInt(commitUtxoForReveal.value),
            },
            // These properties are crucial for a Taproot script-path spend:
            tapLeafScript: [{
                leafVersion: inscriptionLeaf.version,
                script: inscriptionLeaf.output, // The exact inscription script we defined
                controlBlock: bitcoin.payments.p2tr.encode(
                    inscriptionInternalPubkey,
                    tapTree, // Need to pass the full TapTree structure here for the control block
                    network
                ).subarray(34), // The control block is part of the p2tr output after the version and x-only key
            }],
            tapInternalKey: inscriptionInternalPubkey, // The untweaked internal public key
        });

        // Add an output for the change (sending it back to our original funding address)
        revealPsbt.addOutput({
            address: changeAddress, // Send change back to the P2WPKH funding address
            value: BigInt(sendChangeAmount),
        });

        // Sign the input of the reveal transaction using the tweaked private key
        revealPsbt.signInput(0, tweakedChildNode);
        revealPsbt.finalizeAllInputs();

        const revealTx = revealPsbt.extractTransaction();
        const revealTxHex = revealTx.toHex();
        const revealTxId = revealTx.getId();

        outputLog.push(`\n--- Reveal Transaction Details ---`);
        outputLog.push(`Reveal Transaction ID: ${revealTxId}`);
        outputLog.push(`Reveal Transaction Hex: ${revealTxHex}`);

        // --- 10. Broadcast the reveal transaction ---
        outputLog.push(`\nBroadcasting reveal transaction...`);
        const revealBroadcastResult = await rpcClient.broadcast(revealTxHex);
        outputLog.push(`Reveal Broadcast Result: ${JSON.stringify(revealBroadcastResult)}`);
        outputLog.push(`\nInscription process complete! Your inscription is now on-chain with TxID: ${revealTxId}`);

        return {
            status: "success",
            commit_tx_id: commitTxId,
            reveal_tx_id: revealTxId,
            log: outputLog.join("\n")
        };

    } catch (error) {
        outputLog.push(`\nError: ${error.message}`);
        console.error("Error during inscription process:", error);
        return {
            status: "error",
            message: error.message,
            log: outputLog.join("\n")
        };
    }
}

async function createInscriptionTransactions1(params) {
    const {
        fundingWIF = 'cMv1S6n8h2z5r4x3e2d1c0b9a8s7d6f5g4h3j2k1l0m9n8b7v6c5x4z3y2u1t0r',
        initialFaucetAmount = 500_000, // satoshis
        inscriptionContent = "Hello from Node.js Inscription!",
        inscriptionContentType = "text/plain",
        commitTxFee = 2000, // satoshis
        revealTxFee = 10000, // satoshis
        changeAddress = "bcrt1q02j02m4z3k7m8r4x4e7m5l7h9p0q0r9c8d7f6e5a4b3c2d1e0f", // Example P2WPKH for change
        // NEW PARAMETER: WIF for the Taproot address where the inscription will reside
        inscriptionDestinationWIF = 'cT1oXvS2eY7NnF5W1qG2h3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0a1b2c3d4e5f6g7' // Example Regtest Taproot WIF
    } = params;

    const outputLog = [];

    // Import necessary Bitcoin libraries (these would be `require` in a real Node.js environment)
    // We assume these are installed via npm (e.g., npm install bitcoinjs-lib ecpair tiny-secp256k1 bip39 bip32)
    const bitcoin = await import('bitcoinjs-lib');
    const { ECPairFactory } = await import('ecpair');
    const ecc = await import('tiny-secp256k1');
    const bip39 = await import('bip39'); // Still useful if you need to derive new keys
    const bip32 = await import('bip32'); // Still useful if you need to derive new keys

    // Initialize ECPair with the ECC library
    const ECPair = ECPairFactory(ecc);

    // Set the network (Regtest for simulation)
    const network = bitcoin.networks.regtest;
    rpcClient.network = network; // Inform the mock RPC client about the network

    // Helper function to convert a public key to its x-only form (needed for Taproot)
    function toXOnly(pubKey) {
        // Ensure the public key is compressed (33 bytes) before extracting x-only
        if (pubKey.length === 33) {
            return pubKey.subarray(1, 33);
        }
        // If it's already 32 bytes, assume it's x-only
        return pubKey;
    }

    try {
        outputLog.push("Starting inscription process (Node.js server-side)...");

        // --- 1. Setup Wallet with WIF (for funding the commit transaction) ---
        const fundingKeypair = ECPair.fromWIF(fundingWIF, network);
        // For P2WPKH, the address can be derived directly from the public key
        const fundingP2WPKH = bitcoin.payments.p2wpkh({ pubkey: fundingKeypair.publicKey, network: network });
        const actualFundingAddress = fundingP2WPKH.address;

        outputLog.push(`\nUsing Funding WIF: ${fundingWIF}`);
        outputLog.push(`Funding Address (P2WPKH): ${actualFundingAddress}`);

        // --- 2. Fund a UTXO for the commit transaction (using simulator faucet) ---
        outputLog.push(`\nFunding address with ${initialFaucetAmount / 100_000_000} BTC via faucet...`);
        // The faucet conceptually sends to the address derived from our WIF
        await rpcClient.faucet(actualFundingAddress, initialFaucetAmount);

        // Get the UTXOs for the funding address from the conceptual node
        const utxos = await rpcClient.getUtxos(actualFundingAddress);
        if (utxos.length === 0) {
            throw new Error("Failed to get UTXOs for funding address after faucet simulation.");
        }
        const fundingUtxo = utxos[0]; // Assuming the first UTXO is sufficient for our example

        outputLog.push(`Funding UTXO (TxID: ${fundingUtxo.txId}, Vout: ${fundingUtxo.vout}, Value: ${fundingUtxo.value} sats)`);

        // --- 3. Setup Inscription Key from provided WIF (for the Taproot output) ---
        // This key will be the internal key for the Taproot address where the inscription resides.
        const inscriptionKeypair = ECPair.fromWIF(inscriptionDestinationWIF, network);
        const inscriptionInternalPubkey = toXOnly(inscriptionKeypair.publicKey);

        outputLog.push(`\nUsing Inscription Destination WIF: ${inscriptionDestinationWIF}`);
        outputLog.push(`Inscription Internal Pubkey: ${inscriptionInternalPubkey.toString('hex')}`);


        // --- 4. Define the Inscription Content and Script ---
        const inscriptionData = Buffer.from(inscriptionContent, 'utf8');

        // Ordinals inscription script (OP_FALSE OP_IF OP_PUSH 'ord' OP_PUSH 1 OP_PUSH 'text/plain' OP_PUSH 0 OP_PUSH 'content' OP_ENDIF)
        // This is the "envelope" that contains the inscription data.
        const inscriptionScript = bitcoin.script.compile([
            inscriptionInternalPubkey, // The key for the key-path spend (also part of the script path for clarity)
            bitcoin.opcodes.OP_CHECKSIG, // Signature check for key-path or within script-path
            bitcoin.opcodes.OP_FALSE,    // Start of the Ordinals "envelope"
            bitcoin.opcodes.OP_IF,
            Buffer.from('ord'),          // 'ord' protocol identifier
            bitcoin.opcodes.OP_1,        // Tag for content type
            Buffer.from(inscriptionContentType), // MIME type (e.g., 'text/plain')
            bitcoin.opcodes.OP_0,        // Tag for actual content
            inscriptionData,             // The actual inscription data
            bitcoin.opcodes.OP_ENDIF     // End of the Ordinals "envelope"
        ]);

        // Define the Tapscript leaf for our inscription
        const inscriptionLeaf = {
            output: inscriptionScript,
            version: 0xC0, // Tapscript leaf version (0xC0 for unspendable, as used by Ordinals for data)
        };

        // --- 5. Create the Taproot (P2TR) output script for the commit transaction ---
        // This output will be where the funds for the inscription are sent.
        // The `scriptTree` parameter commits to the inscriptionLeaf.
        const { address: p2trAddress, output: p2trOutputScript, tapTree } = bitcoin.payments.p2tr({
            internalPubkey: inscriptionInternalPubkey,
            scriptTree: inscriptionLeaf, // This is a single leaf, so it effectively forms the tree
            network: network,
        });

        outputLog.push(`\nGenerated P2TR Address (Commitment Destination): ${p2trAddress}`);
        outputLog.push(`Generated P2TR Output Script (hex): ${p2trOutputScript.toString('hex')}`);
        outputLog.push(`Inscription Content: "${inscriptionContent}" (Type: ${inscriptionContentType})`);

        // --- 6. Build the Commit PSBT (Partially Signed Bitcoin Transaction) ---
        const sendAmountToP2TR = fundingUtxo.value - commitTxFee;
        if (sendAmountToP2TR <= 0) {
            throw new Error("Insufficient funds for commit transaction after fees.");
        }

        const commitPsbt = new bitcoin.Psbt({ network: network });

        // Add the input from our funded UTXO
        commitPsbt.addInput({
            hash: fundingUtxo.txId,
            index: fundingUtxo.vout,
            witnessUtxo: fundingP2WPKH.output ? { script: fundingP2WPKH.output, value: BigInt(fundingUtxo.value) } : undefined,
            // For P2WPKH, witnessUtxo is enough. For other types, might need redeemScript, script or nonWitnessUtxo
        });

        // Add the P2TR output (the inscription's destination UTXO)
        commitPsbt.addOutput({
            address: p2trAddress,
            value: BigInt(sendAmountToP2TR),
        });

        // Sign the input of the commit transaction using the funding WIF's keypair
        commitPsbt.signInput(0, fundingKeypair);
        commitPsbt.finalizeAllInputs(); // Finalize all inputs to get the full transaction

        const commitTx = commitPsbt.extractTransaction();
        const commitTxHex = commitTx.toHex();
        const commitTxId = commitTx.getId();

        outputLog.push(`\n--- Commit Transaction Details ---`);
        outputLog.push(`Commit Transaction ID: ${commitTxId}`);
        outputLog.push(`Commit Transaction Hex: ${commitTxHex}`);

        // --- 7. Broadcast the commit transaction ---
        outputLog.push(`\nBroadcasting commit transaction...`);
        const commitBroadcastResult = await rpcClient.broadcast(commitTxHex);
        outputLog.push(`Commit Broadcast Result: ${JSON.stringify(commitBroadcastResult)}`);
        outputLog.push(`Commit transaction successfully broadcast! Funds locked in P2TR UTXO.`);

        // Wait for the commit transaction to be mined (simulate block generation)
        outputLog.push(`\nSimulating block generation for commit transaction...`);
        await rpcClient.mine(1); // Mine 1 block to confirm the commit tx
        outputLog.push(`Commit transaction confirmed!`);

        // --- 8. Prepare for Reveal Transaction ---
        // The UTXO to spend in the reveal transaction is the output of the commit transaction.
        const commitUtxoForReveal = {
            txId: commitTxId,
            vout: 0, // Our P2TR output is typically the first output of the commit transaction
            value: sendAmountToP2TR,
            script: p2trOutputScript,
        };

        // Tweak the private key from the provided inscriptionDestinationWIF.
        // This tweaked key is used to sign the reveal transaction via the script path.
        // `tapTree.merkleRoot` provides the necessary tweak factor.
        const tweakedPrivateKeyBytes = ecc.privateAdd(inscriptionKeypair.privateKey, tapTree.merkleRoot);
        if (!tweakedPrivateKeyBytes) {
            throw new Error("Could not tweak private key. Resulting key was invalid (e.g., zero).");
        }
        const tweakedInscriptionKeypair = ECPair.fromPrivateKey(tweakedPrivateKeyBytes, { network: network });


        // --- 9. Build the Reveal PSBT ---
        const sendChangeAmount = commitUtxoForReveal.value - revealTxFee;
        if (sendChangeAmount < 546) { // Bitcoin dust limit for outputs (typically 546 sats for P2WPKH)
            throw new Error(`Change amount (${sendChangeAmount} sats) is below dust limit (546 sats). Increase initialFaucetAmount or reduce fees.`);
        }

        const revealPsbt = new bitcoin.Psbt({ network: network });

        // Add the P2TR input from the commit transaction
        revealPsbt.addInput({
            hash: commitUtxoForReveal.txId,
            index: commitUtxoForReveal.vout,
            witnessUtxo: {
                script: commitUtxoForReveal.script,
                value: BigInt(commitUtxoForReveal.value),
            },
            // These properties are crucial for a Taproot script-path spend:
            tapLeafScript: [{
                leafVersion: inscriptionLeaf.version,
                script: inscriptionLeaf.output, // The exact inscription script we defined
                controlBlock: bitcoin.payments.p2tr.encode(
                    inscriptionInternalPubkey,
                    tapTree, // Need to pass the full TapTree structure here for the control block
                    network
                ).subarray(34), // The control block is part of the p2tr output after the version and x-only key
            }],
            tapInternalKey: inscriptionInternalPubkey, // The untweaked internal public key
        });

        // Add an output for the change (sending it back to our original funding address)
        revealPsbt.addOutput({
            address: changeAddress, // Send change back to the P2WPKH funding address
            value: BigInt(sendChangeAmount),
        });

        // Sign the input of the reveal transaction using the tweaked private key
        revealPsbt.signInput(0, tweakedInscriptionKeypair);
        revealPsbt.finalizeAllInputs();

        const revealTx = revealPsbt.extractTransaction();
        const revealTxHex = revealTx.toHex();
        const revealTxId = revealTx.getId();

        outputLog.push(`\n--- Reveal Transaction Details ---`);
        outputLog.push(`Reveal Transaction ID: ${revealTxId}`);
        outputLog.push(`Reveal Transaction Hex: ${revealTxHex}`);

        // --- 10. Broadcast the reveal transaction ---
        outputLog.push(`\nBroadcasting reveal transaction...`);
        const revealBroadcastResult = await rpcClient.broadcast(revealTxHex);
        outputLog.push(`Reveal Broadcast Result: ${JSON.stringify(revealBroadcastResult)}`);
        outputLog.push(`\nInscription process complete! Your inscription is now on-chain with TxID: ${revealTxId}`);

        return {
            status: "success",
            commit_tx_id: commitTxId,
            reveal_tx_id: revealTxId,
            log: outputLog.join("\n")
        };

    } catch (error) {
        outputLog.push(`\nError: ${error.message}`);
        console.error("Error during inscription process:", error);
        return {
            status: "error",
            message: error.message,
            log: outputLog.join("\n")
        };
    }
}


// Example usage (if running in a Node.js script environment):
/*
(async () => {
    const result = await createInscriptionTransactions({}); // Use default parameters
    console.log("\n--- Final Result ---");
    console.log(result.log);
    if (result.status === "success") {
        console.log(`Commit Tx ID: ${result.commit_tx_id}`);
        console.log(`Reveal Tx ID: ${result.reveal_tx_id}`);
    }
})();
*/
