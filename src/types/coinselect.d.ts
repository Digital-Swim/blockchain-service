declare module 'coinselect' {
    export interface UTXO {
        txId: string;
        vout: number;
        value: number;
        address?: string
    }

    export interface Target {
        address?: string;
        script?: Buffer;
        value: number;
    }

    export interface CoinSelectResult {
        inputs: UTXO[];
        outputs: Target[];
        fee: number;
    }

    function coinSelect(
        utxos: UTXO[],
        targets: Target[],
        feeRate: number
    ): CoinSelectResult;

    export default coinSelect;
}

declare module 'coinselect/accumulative.js' {
    import { UTXO, Target, CoinSelectResult } from 'coinselect';
    function accumulative(
        utxos: UTXO[],
        targets: Target[],
        feeRate: number
    ): CoinSelectResult;
    export default accumulative;
}

declare module 'coinselect/blackjack.js' {
    import { UTXO, Target, CoinSelectResult } from 'coinselect';
    function blackjack(
        utxos: UTXO[],
        targets: Target[],
        feeRate: number
    ): CoinSelectResult;
    export default blackjack;
}

declare module 'coinselect/break.js' {
    import { UTXO, Target, CoinSelectResult } from 'coinselect';
    function broken(
        utxos: UTXO[],
        targets: Target[],
        feeRate: number
    ): CoinSelectResult;
    export default broken;
}

declare module 'coinselect/split.js' {
    import { UTXO, Target, CoinSelectResult } from 'coinselect';
    function split(
        utxos: UTXO[],
        targets: Target[],
        feeRate: number
    ): CoinSelectResult;
    export default split;
}
