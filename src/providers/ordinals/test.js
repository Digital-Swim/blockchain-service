// createInscriptionTx.js

// Import necessary libraries
const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair').ECPairFactory;
const tinysecp = require('tiny-secp256k1');

// Inject tiny-secp256k1 into ECPair for Taproot functionality
const ECPair = ECPairFactory(tinysecp);
const { payments, script, Psbt, networks } = bitcoin;

/**
 * Creates Bitcoin Ordinal Inscription commit and reveal transactions.
 *
 * @param {Object} options - Configuration options for the inscription.
 * @param {string} options.privateKeyWIF - Your private key in WIF format (Testnet recommended for safety).
 * @param {string} options.utxoTxId - Transaction ID of an unspent UTXO you own.
 * @param {number} options.utxoVout - Output index of the UTXO.
 * @param {number} options.utxoAmount - Amount of the UTXO in satoshis.
 * @param {number} options.feeRate - Transaction fee rate in satoshis per virtual byte (sats/vB).
 * @param {string} options.contentType - MIME type of the inscription content (e.g., 'text/plain;charset=utf-8', 'image/png').
 * @param {string} options.inscriptionContent - The actual content to inscribe.
 * @param {string} options.recipientAddress - The Taproot address where the inscribed satoshi will be sent.
 * @returns {Promise<{commitTxHex: string, revealTxHex: string}>} An object containing the raw hex for both transactions.
 */
async function createInscriptionTransactions(options) {
    const {
        privateKeyWIF,
        utxoTxId,
        utxoVout,
        utxoAmount,
        feeRate,
        contentType,
        inscriptionContent,
        recipientAddress
    } = options;

    try {
        // --- 1. Derive Keys and P2TR Address ---
        // For testnet, ensure networks.testnet is used.
        // For mainnet, use networks.bitcoin.
        const network = networks.testnet;
        const keyPair = ECPair.fromWIF(privateKeyWIF, network);
        // The internalPubkey is typically the x-only pubkey (32 bytes)
        const p2tr = payments.p2tr({ internalPubkey: keyPair.publicKey.slice(1), network });

        // --- 2. Create Inscription Script (Ordinal 'envelope') ---
        // This is the core script that embeds the data according to the Ordinals protocol.
        // OP_FALSE OP_IF 'ord' OP_1 [content_type] OP_0 [content] OP_ENDIF
        const inscriptionScript = [
            script.OPS.OP_FALSE, // Starts an unexecuted conditional, making the data non-executable
            script.OPS.OP_IF,
            Buffer.from('ord', 'utf8'), // Ordinal protocol identifier
            script.OPS.OP_1,             // Tag for content type
            Buffer.from(contentType, 'utf8'), // The MIME type of the content
            script.OPS.OP_0,             // Tag for content body
            Buffer.from(inscriptionContent, 'utf8'), // The actual inscription data
            script.OPS.OP_ENDIF,         // Ends the unexecuted conditional
        ];

        // The script tree defines the Tapscript leaf that will contain our inscription
        const scriptTree = {
            output: script.compile(inscriptionScript),
        };

        // This object describes the specific Tapscript path for spending the inscription UTXO
        const tapLeafScript = {
            leafVersion: script.TAPSCRIPT_LEAF_VERSION,
            script: scriptTree.output,
            controlBlock: p2tr.controlBlock, // This will be generated/validated by PSBT internally during finalization
        };

        // --- 3. Build Commit Transaction (Creates the Taproot output holding the inscription commitment) ---
        // This transaction sends the 546 sats to a Taproot address whose script path commits to the inscription.
        const commitPsbt = new Psbt({ network });

        // Input: Your existing UTXO
        commitPsbt.addInput({
            hash: utxoTxId,
            index: utxoVout,
            witnessUtxo: {
                script: p2tr.output, // The scriptPubKey for the address owning the input UTXO
                value: utxoAmount,
            },
            tapInternalKey: p2tr.internalPubkey, // Important for P2TR inputs
        });

        // Output 1: The inscription output (dust limit for P2TR)
        const inscriptionOutputAmount = 546; // Standard Ordinals dust limit
        commitPsbt.addOutput({
            script: p2tr.script, // The scriptPubKey of the Taproot inscription address
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
                address: p2tr.address, // Re-use the same P2TR address for change, or derive a new one
                value: changeAmount,
            });
        }

        // Sign the input of the commit transaction
        commitPsbt.signInput(0, keyPair);
        commitPsbt.finalizeAllInputs(); // Finalize the PSBT to get the raw transaction

        const commitTx = commitPsbt.extractTransaction();
        const commitTxHex = commitTx.toHex();

        // --- 4. Build Reveal Transaction (Spends the Taproot output, revealing inscription) ---
        // This transaction spends the 546 sat Taproot UTXO from the commit transaction.
        // The full inscription script is revealed in the witness data during this spend.
        const revealPsbt = new Psbt({ network });

        // Input: The inscription UTXO from the commit transaction
        const revealTxId = commitTx.getId(); // Get the TxID of the newly created commit transaction
        const revealVout = 0; // The inscription output is the first (index 0) output of the commit transaction
        const revealUtxoValue = inscriptionOutputAmount; // This value is 546 sats

        revealPsbt.addInput({
            hash: revealTxId,
            index: revealVout,
            witnessUtxo: {
                script: p2tr.output, // The scriptPubKey of the P2TR address
                value: revealUtxoValue,
            },
            // Crucial: Specify the tapLeafScript to reveal the inscription data
            tapLeafScript: [tapLeafScript],
            tapInternalKey: p2tr.internalPubkey,
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
        revealPsbt.signInput(0, keyPair);
        revealPsbt.finalizeAllInputs();

        const revealTx = revealPsbt.extractTransaction();
        const revealTxHex = revealTx.toHex();

        return { commitTxHex, revealTxHex };

    } catch (error) {
        console.error("Error creating inscription transactions:", error.message);
        throw error; // Re-throw to be handled by the caller
    }
}

// --- Example Usage ---
// !! IMPORTANT: REPLACE WITH YOUR ACTUAL TESTNET DETAILS !!
const myInscriptionDetails = {
    privateKeyWIF: 'cR8D7r9tX4y3Z2a1B0c9V8u7T6s5R4q3P2o1N0m9L8k7J6I5H4G3F2E1D0C9B8A7s6', // Testnet WIF Private Key
    utxoTxId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',     // A confirmed UTXO's transaction ID
    utxoVout: 0,                                                                       // The output index of that UTXO
    utxoAmount: 50000,                                                                  // Amount of that UTXO in satoshis (must be enough to cover inscription + fees)
    feeRate: 10,                                                                       // Sats per virtual byte
    contentType: 'text/plain;charset=utf-8',                                           // MIME type of content
    inscriptionContent: 'Hello from Gemini on Bitcoin Testnet! This is a server-side inscription.', // Your desired content
    recipientAddress: 'tb1p9x89p67q23q662a8p464f43477j68c7e0c4t9f237f4p9g2r5q0s9w8r', // Your Taproot recipient address
};

// Execute the function and log the results
(async () => {
    console.log("Generating Bitcoin Inscription Transactions...");
    try {
        const { commitTxHex, revealTxHex } = await createInscriptionTransactions(myInscriptionDetails);

        console.log("\n--- Commit Transaction Hex ---");
        console.log(commitTxHex);

        console.log("\n--- Reveal Transaction Hex ---");
        console.log(revealTxHex);

        console.log("\nIMPORTANT: These are raw transaction hexes. You must broadcast the commit transaction FIRST,");
        console.log("wait for it to confirm, and then broadcast the reveal transaction to inscribe your data.");
        console.log("Use a testnet block explorer or a Bitcoin node's RPC for broadcasting.");

    } catch (error) {
        console.error("\nFailed to generate inscription transactions:", error.message);
    }
})();

