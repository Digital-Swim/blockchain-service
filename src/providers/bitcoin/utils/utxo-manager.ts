import { RowDataPacket } from 'mysql2/promise';
import { BitcoinUtxo } from '../../../types/bitcoin.js';
import { db } from '../../../db/database.js';

export class UtxoManager {

    // Add a new UTXO or update if it exists (upsert)
    async addUtxo(utxo: BitcoinUtxo): Promise<void> {
        const sql = `
            INSERT INTO utxos (txid, vout, amount, confirmations, script_pub_key, status, address, spent_in_txid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                confirmations = VALUES(confirmations),
                status = VALUES(status),
                spent_in_txid = VALUES(spentInTxId),
                updated_at = CURRENT_TIMESTAMP
        `;

        await db.query(sql, [
            utxo.txId,
            utxo.vout,
            utxo.value,
            utxo.confirmations ?? 0,
            utxo.scriptPubKey ?? '',
            utxo.status ?? 'pending',
            utxo.address ?? '',
            utxo.spentInTxId ?? null,
        ]);
    }

    // Get all unspent UTXOs for an address
    async getUnspentUtxos(address: string): Promise<BitcoinUtxo[]> {
        const sql = `
            SELECT txid AS txId, vout, amount AS value, confirmations, script_pub_key AS scriptPubKey, status, address, spent_in_txid AS spentInTxId
            FROM utxos
            WHERE address = ? AND status = 'unspent'
        `;
        const [rows] = await db.query<RowDataPacket[]>(sql, [address]);
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
    async getTotalBalance(address: string): Promise<number> {
        const sql = `
            SELECT COALESCE(SUM(amount), 0) as balance
            FROM utxos
            WHERE address = ? AND status = 'unspent'
        `;
        const [rows] = await db.query<RowDataPacket[]>(sql, [address]);
        return rows[0]?.balance ?? 0;
    }
}

