import accumulative from 'coinselect/accumulative.js';
import blackjack from 'coinselect/blackjack.js';
import broken from 'coinselect/break.js';
import split from 'coinselect/split.js';
import coinSelect from 'coinselect';

import type { Target, CoinSelectResult } from 'coinselect';
import { BitcoinUtxo, UtxoSelectStrategy } from '../../../types/bitcoin.js';

export class UtxoSelector {
    strategy: UtxoSelectStrategy;

    /**
     * Create a UTXO selector instance with a given strategy.
     * @param strategy - The coin selection strategy ('default', 'accumulative', 'blackjack', 'break', or 'split').
     */
    constructor(strategy: UtxoSelectStrategy = 'default') {
        this.strategy = strategy;
    }

    /**
     * Default strategy:
     * Tries 'blackjack' first (prefers no change) with sorted inputs, then falls back to 'accumulative' for sorted inputs.
     * Efficient for most transactions with a balance of performance and privacy.
     *
     * @param utxos - List of unspent transaction outputs.
     * @param targets - Desired outputs with target values excluding change output
     * @param feeRate - Fee rate in satoshis per byte.
     * @returns Selected inputs, outputs, and estimated fee.
     */
    selectDefault(utxos: BitcoinUtxo[], targets: Target[], feeRate: number): CoinSelectResult {
        return coinSelect(utxos, targets, feeRate);
    }

    /**
     * Accumulative strategy:
     * Adds UTXOs until the target (+fee) is reached, skipping those that increase cost disproportionately.
     * Ideal for UTXO consolidation or sweeping wallets.
     *
     * @param utxos - List of unspent transaction outputs.
     * @param targets - Desired outputs with target values excluding change output
     * @param feeRate - Fee rate in satoshis per byte.
     * @returns Selected inputs, outputs, and estimated fee.
     */
    selectAccumulative(utxos: BitcoinUtxo[], targets: Target[], feeRate: number): CoinSelectResult {
        return accumulative(utxos, targets, feeRate);
    }

    /**
     * Blackjack strategy:
     * Selects UTXOs that match the target (+fee) as closely as possible without going over.
     * Avoids change outputs, making transactions smaller and more private.
     *
     * @param utxos - List of unspent transaction outputs.
     * @param targets - Desired outputs with target values excluding change output
     * @param feeRate - Fee rate in satoshis per byte.
     * @returns Selected inputs, outputs, and estimated fee.
     */
    selectBlackjack(utxos: BitcoinUtxo[], targets: Target[], feeRate: number): CoinSelectResult {
        return blackjack(utxos, targets, feeRate);
    }

    /**
     * Break strategy:
     * Uses inputs and breaks change into multiple outputs with the same denomination as inputs.
     * Mimics CoinJoin-style output uniformity for increased privacy.
     *
     * @param utxos - List of unspent transaction outputs.
     * @param targets - Desired outputs with target values excluding change output
     * @param feeRate - Fee rate in satoshis per byte.
     * @returns Selected inputs, outputs, and estimated fee.
     */
    selectBreak(utxos: BitcoinUtxo[], targets: Target[], feeRate: number): CoinSelectResult {
        return broken(utxos, targets, feeRate);
    }

    /**
     * Split strategy:
     * Splits total input value evenly across all outputs.
     * Fixed-value outputs remain unchanged. Useful for airdrops or equal payouts.
     *
     * @param utxos - List of unspent transaction outputs.
     * @param targets - Desired outputs with target values excluding change output
     * @param feeRate - Fee rate in satoshis per byte.
     * @returns Selected inputs, outputs, and estimated fee.
     */
    selectSplit(utxos: BitcoinUtxo[], targets: Target[], feeRate: number): CoinSelectResult {
        return split(utxos, targets, feeRate);
    }

    /**
     * Selects UTXOs based on the strategy specified in the constructor.
     *
     * @param utxos - List of unspent transaction outputs.
     * @param targets - Desired outputs with target values excluding change output
     * @param feeRate - Fee rate in satoshis per byte.
     * @returns Selected inputs, outputs, and estimated fee.
     */
    private selectWithFeeRate(utxos: BitcoinUtxo[], targets: Target[], feeRate: number): CoinSelectResult {
        switch (this.strategy) {
            case 'accumulative':
                return this.selectAccumulative(utxos, targets, feeRate);
            case 'blackjack':
                return this.selectBlackjack(utxos, targets, feeRate);
            case 'break':
                return this.selectBreak(utxos, targets, feeRate);
            case 'split':
                return this.selectSplit(utxos, targets, feeRate);
            case 'default':
            default:
                return this.selectDefault(utxos, targets, feeRate);
        }
    }

    /**
     * Selects UTXOs based on either a fee rate or a fixed fee.
     *
     * @param {BitcoinUtxo[]} utxos - The list of available unspent transaction outputs.
     * @param {Target[]} targets - The list of outputs 
     * @param {number} [feeRate] - The fee rate in satoshis per byte (used if fixedFee is not provided).
     * @param {number} [fixedFee] - A fixed total fee in satoshis (overrides feeRate if provided).
     * @returns {CoinSelectResult} - The result containing selected inputs, calculated outputs, and fee.
     * @throws {Error} - If neither `feeRate` nor `fixedFee` is provided.
     */
    select(
        utxos: BitcoinUtxo[],
        targets: Target[],
        feeRate?: number,
        fixedFee?: number
    ): CoinSelectResult {

        if (!utxos || utxos.length === 0) {
            throw new Error('No UTXOs provided for selection.');
        }
        if (fixedFee != null) {
            return this.selectWithFixedFee(utxos, targets, fixedFee);
        } else if (feeRate != null) {
            return this.selectWithFeeRate(utxos, targets, feeRate);
        } else {
            throw new Error('Either fixedFee or feeRate must be provided.');
        }
    }


    /**
     * Selects UTXOs to meet the target amount using a fixed fee.
     * Internally adjusts the target value to include the fixed fee, then runs standard feeRate-based selection with feeRate = 0.
     *
     * @param {BitcoinUtxo[]} utxos - The list of available UTXOs.
     * @param {Target[]} targets - The original transaction output targets.
     * @param {number} fixedFee - The fixed fee amount in satoshis to apply.
     * @returns {CoinSelectResult} - The selection result with inputs, adjusted outputs, and fixed fee.
     */
    private selectWithFixedFee(
        utxos: BitcoinUtxo[],
        targets: Target[],
        fixedFee: number
    ): CoinSelectResult {
        // Clone targets so we don't mutate original
        const adjustedTargets = targets.map((t, i) => {
            // Only add fee to the first output
            return i === 0
                ? { ...t, value: t.value + fixedFee }
                : { ...t };
        });

        // Use feeRate = 0 to bypass internal fee calculation
        const result = this.selectWithFeeRate(utxos, adjustedTargets, 0);

        if (result.inputs && result.outputs) {
            // Now fix the outputs: subtract fee from first output if there's no change
            const outputs = result.outputs.map((o, i) => {
                if (!o.address) return o; // change output
                return i === 0 ? { ...o, value: o.value - fixedFee } : o;
            });

            return {
                ...result,
                outputs,
                fee: fixedFee,
            };
        }

        return result;
    }
}


export function runUtxoSelectorTests(): void {
    const utxos = [
        { txId: 'a1', vout: 0, value: 3000 },
        { txId: 'a2', vout: 1, value: 4000 },
        { txId: 'a3', vout: 2, value: 2000 },
        { txId: 'a4', vout: 3, value: 5000 }
    ];

    const targets = [
        { address: "bsc1", value: 8500 }
    ]
    const feeRate = 1; // sat/byte
    const fixedFee = 1000;

    const strategies: UtxoSelectStrategy[] = ['default', 'accumulative', 'blackjack', 'break', 'split'] as const;


    for (const strategy of strategies) {
        console.log(`\n--- Testing strategy: ${strategy} ---`);

        const selector = new UtxoSelector(strategy);

        console.log(`\n--- Using fee rate ${feeRate}`);
        const resultFeeRate = selector.select(utxos, targets, feeRate, undefined);
        output(resultFeeRate);

        console.log(`\n--- Using fixed fee ${fixedFee}`);
        const resultFixedFee = selector.select(utxos, targets, undefined, fixedFee);
        output(resultFixedFee);


    }

    function output(result: CoinSelectResult) {
        if (!result.inputs || !result.outputs) {
            console.log('❌ No valid selection');
        } else {
            console.log('✅ Inputs:', result.inputs);
            console.log('✅ Outputs:', result.outputs);
            console.log('✅ Fee:', result.fee);
        }
    }

}

