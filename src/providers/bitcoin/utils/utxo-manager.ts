import { RowDataPacket } from 'mysql2/promise';
import { BitcoinProvider, BitcoinUtxo, UtxoManager } from '../../../types/bitcoin.js';
import { db } from '../../../db/database.js';
import { FallbackBitcoinProvider } from '../fallback-provider.js';

export class LocalUtxoManager implements UtxoManager {

    private bitcoinProvider?: FallbackBitcoinProvider | BitcoinProvider;

    constructor(bitcoinProvider?: BitcoinProvider | FallbackBitcoinProvider) {
        this.bitcoinProvider = bitcoinProvider
    }


    async addUtxos(utxos: BitcoinUtxo[]): Promise<void> {

        if (!utxos.length) return;

        const sql = `
            INSERT INTO utxos (txid, vout, amount, confirmations, script_pub_key, status, address, spent_in_txid)
            VALUES ${utxos.map(() => `(?, ?, ?, ?, ?, ?, ?, ?)`).join(', ')}
            ON DUPLICATE KEY UPDATE
                confirmations = VALUES(confirmations),
                status = VALUES(status),
                spent_in_txid = VALUES(spent_in_txid),
                updated_at = CURRENT_TIMESTAMP
        `;

        const values = utxos.flatMap(utxo => [
            utxo.txId,
            utxo.vout,
            utxo.value,
            utxo.confirmations ?? 0,
            utxo.scriptPubKey ?? '',
            utxo.status ?? 'pending',
            utxo.address ?? '',
            utxo.spentInTxId ?? null,
        ]);

        await db.query(sql, values);

    }

    // Get all unspent UTXOs for an address
    async getUnspentUtxos(address?: string): Promise<BitcoinUtxo[]> {
        const sql = `
            SELECT txid AS txId, vout, amount AS value, confirmations, script_pub_key AS scriptPubKey, status, address, spent_in_txid AS spentInTxId
            FROM utxos
            WHERE address = ? AND status = 'unspent'
        `;
        const [rows] = await db.query<RowDataPacket[]>(sql, [address!]);
        return rows as BitcoinUtxo[];
    }

    // Mark a UTXO as spent with the spending txid
    async markUtxoAsSpent(txId: string, vout: number, spentInTxid: string): Promise<void> {
        const sql = `
            UPDATE utxos
            SET status = 'spent', spent_in_txid = ?, updated_at = CURRENT_TIMESTAMP
            WHERE txid = ? AND vout = ? AND status != 'spent'
        `;
        await db.query(sql, [spentInTxid, txId, vout]);
    }

    // Mark a UTXO as confirmed and update confirmations count
    async markUtxoAsConfirmed(txId: string, vout: number, confirmations: number): Promise<void> {
        const sql = `
            UPDATE utxos
            SET confirmations = ?, status = 'unspent', updated_at = CURRENT_TIMESTAMP
            WHERE txid = ? AND vout = ? AND status != 'spent'
        `;
        await db.query(sql, [confirmations, txId, vout]);
    }

    // Get total balance of unspent UTXOs for an address
    async getTotalBalance(address?: string): Promise<number> {
        const sql = `
            SELECT COALESCE(SUM(amount), 0) as balance
            FROM utxos
            WHERE address = ? AND status = 'unspent'
        `;
        const [rows] = await db.query<RowDataPacket[]>(sql, [address!]);
        return rows[0]?.balance ?? 0;
    }

    async deleteUtxos(address?: string): Promise<void> {
        const sql = `DELETE FROM utxos WHERE address = ?`;
        await db.query(sql, [address!]);
    }


    async reset(address?: string) {

        const utxos = await this.bitcoinProvider?.getAddressUtxos(address!)
        await this.deleteUtxos(address!)

        if (utxos?.length)
            this.addUtxos(utxos!);

    }
}

