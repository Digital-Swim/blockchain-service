import * as bitcoin from "bitcoinjs-lib";
import { RowDataPacket } from 'mysql2/promise';
import { db } from '../../../db/database.js';
import { BitcoinProvider, BitcoinTransactionStatus, BitcoinUtxo, UtxoManager } from '../../../types/bitcoin.js';
import { NetworkType } from '../../../types/common.js';
import { decodeRawTransaction } from '../../../utils/common.js';
import { FallbackBitcoinProvider } from '../fallback-provider.js';
export class BitcoinUtxoManager implements UtxoManager {

    private bitcoinProvider?: FallbackBitcoinProvider | BitcoinProvider;

    constructor(bitcoinProvider?: BitcoinProvider | FallbackBitcoinProvider) {
        this.bitcoinProvider = bitcoinProvider
    }


    async addUtxos(utxos: BitcoinUtxo[]): Promise<void> {

        if (!utxos.length) return;

        const sql = `
        INSERT INTO utxos (txid, vout, amount, confirmations, script_pub_key, status, address, spent_in_txid)
        VALUES ${utxos.map(() => `(?, ?, ?, ?, ?, ?, ?, ?)`).join(', ')}
    `;

        const values = utxos.flatMap(utxo => [
            utxo.txId,
            utxo.vout,
            utxo.value,
            utxo.confirmations,
            utxo.scriptPubKey ?? '',
            utxo.status,
            utxo.address,
            utxo.spentInTxId,
        ]);

        await db.query(sql, values);

    }

    // Get all unspent UTXOs for an address
    async getUnspentUtxos(address: string, fromNetwork: boolean = false): Promise<BitcoinUtxo[]> {

        if (fromNetwork) {
            return this.reset(address);
        }

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
            SET status = 'spent', spent_in_txid = ?
            WHERE txid = ? AND vout = ? AND status != 'spent'
        `;
        await db.query(sql, [spentInTxid, txId, vout]);
    }

    // Get total balance of unspent UTXOs for an address
    async getTotalBalance(address: string): Promise<number> {
        const sql = `
            SELECT COALESCE(SUM(amount), 0) as balance
            FROM utxos
            WHERE address = ? AND status = 'unspent'
        `;
        const [rows] = await db.query<RowDataPacket[]>(sql, [address!]);
        return rows[0]?.balance ?? 0;
    }

    async deleteUtxos(address: string): Promise<void> {
        const sql = `DELETE FROM utxos WHERE address = ?`;
        await db.query(sql, [address!]);
    }

    async reset(address: string): Promise<BitcoinUtxo[]> {
        if (!this.bitcoinProvider) throw new Error("bitcoin provider not set for address class object");
        const utxos = await this.bitcoinProvider?.getAddressUtxos(address!, true)
        await this.deleteUtxos(address!)
        if (utxos?.length) {
            await this.addUtxos(utxos!);
        }
        return utxos.filter(utxo => utxo.status === "unspent");
    }

    async updateUtxos(utxos: BitcoinUtxo[]): Promise<void> {
        if (!utxos.length) return;

        const updates = await Promise.all(utxos.map(utxo => {
            const sql = `
                UPDATE utxos
                SET confirmations = ?, status = ?, spent_in_txid = ?
                WHERE txid = ? AND vout = ?
            `;
            const values = [
                utxo.confirmations,
                utxo.status,
                utxo.spentInTxId,
                utxo.txId,
                utxo.vout
            ];
            return db.query(sql, values);
        }));
    }

    async udpateUtxos(txHex: string, status: BitcoinTransactionStatus, network: bitcoin.Network | NetworkType) {
        const tx = decodeRawTransaction(txHex, network);
        console.log(tx)
        const connection = await db.getConnection();
        let newUtxos: any = [];
        try {
            await connection.beginTransaction();

            if (status === "failed") {
                const utxoToDelete = tx.vout.map((o, index) => ({
                    txId: tx.txid,
                    vout: o.n
                }));

                if (utxoToDelete.length > 0) {
                    const placeholders = utxoToDelete.map(() => `(?, ?)`).join(', ');
                    const values = utxoToDelete.flatMap(u => [u.txId, u.vout]);
                    const sql = `DELETE FROM utxos WHERE (txid, vout) IN (${placeholders})`;
                    await connection.query(sql, values);
                }
            }
            else if (status === "pending") {

                newUtxos = tx.vout.map((output, index) => {
                    return {
                        txId: tx.txid,
                        vout: output.n,
                        value: output.value,
                        address: output.addresses?.join(","),
                        status: "pending",
                        confirmations: status === "pending" ? 0 : 1,
                        scriptPubKey: output.scriptPubKey,
                        spentInTxId: tx.txid
                    } as BitcoinUtxo;
                });


                const sql = `
                INSERT INTO utxos (txid, vout, amount, confirmations, script_pub_key, status, address, spent_in_txid)
                VALUES ${newUtxos.map(() => `(?, ?, ?, ?, ?, ?, ?, ?)`).join(', ')}
            `;

                const values = newUtxos.flatMap((utxo: BitcoinUtxo) => [
                    utxo.txId,
                    utxo.vout,
                    utxo.value,
                    utxo.confirmations,
                    utxo.scriptPubKey ?? '',
                    utxo.status,
                    utxo.address,
                    utxo.spentInTxId,
                ]);

                await db.query(sql, values);

            }
            else {
                newUtxos = tx.vout.map((output, index) => {
                    return {
                        txId: tx.txid,
                        vout: output.n,
                        status: "unspent",
                        confirmations: 1
                    } as BitcoinUtxo;
                });

            }

            const spentUtxos = tx.vin.map((input) => ({
                txId: input.txid,
                vout: input.vout,
                status: status === "failed" ? "unspent" : "spent",
                spentInTxId: tx.txid,
            }));

            const allUtxos = [...spentUtxos, ...newUtxos];

            for (const utxo of allUtxos) {

                const updateSql = `
                    UPDATE utxos
                    SET  confirmations = IFNULL(?,confirmations), status = ?, spent_in_txid = IFNULL(?, spent_in_txid)
                    WHERE txid = ? AND vout = ?
                `;
                const values = [
                    utxo.confirmations,
                    utxo.status,
                    utxo.spentInTxId,
                    utxo.txId,
                    utxo.vout
                ];
                await connection.query(updateSql, values);
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }


}

