declare module 'coinselect' {

    export interface Target {
        address?: string;
        script?: Buffer;
        value: number;
    }

    export interface CoinSelectResult {
        inputs: BitcoinUtxo[];
        outputs: Target[];
        fee: number;
    }

    function coinSelect(
        utxos: BitcoinUtxo[],
        targets: Target[],
        feeRate: number
    ): CoinSelectResult;

    export default coinSelect;
}

declare module 'coinselect/accumulative.js' {
    import { BitcoinUtxo, Target, CoinSelectResult } from 'coinselect';
    function accumulative(
        utxos: BitcoinUtxo[],
        targets: Target[],
        feeRate: number
    ): CoinSelectResult;
    export default accumulative;
}

declare module 'coinselect/blackjack.js' {
    import { BitcoinUtxo, Target, CoinSelectResult } from 'coinselect';
    function blackjack(
        utxos: BitcoinUtxo[],
        targets: Target[],
        feeRate: number
    ): CoinSelectResult;
    export default blackjack;
}

declare module 'coinselect/break.js' {
    import { BitcoinUtxo, Target, CoinSelectResult } from 'coinselect';
    function broken(
        utxos: BitcoinUtxo[],
        targets: Target[],
        feeRate: number
    ): CoinSelectResult;
    export default broken;
}

declare module 'coinselect/split.js' {
    import { BitcoinUtxo, Target, CoinSelectResult } from 'coinselect';
    function split(
        utxos: BitcoinUtxo[],
        targets: Target[],
        feeRate: number
    ): CoinSelectResult;
    export default split;
}
