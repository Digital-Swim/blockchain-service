import mysql, { QueryResult } from 'mysql2/promise';

class Database {
    private pool: mysql.Pool;

    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || '',
            database: process.env.DB_NAME || 'blockchain_service',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });
    }

    async query<T extends QueryResult>(sql: string, params?: any[]): Promise<[T, mysql.FieldPacket[]]> {
        return this.pool.query<T>(sql, params);
    }


    async close(): Promise<void> {
        await this.pool.end();

    }

    async getConnection() {
        return this.pool.getConnection();
    }
}

export const db = new Database();
