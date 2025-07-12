// Rpc.ts
import axios, { AxiosInstance } from 'axios';
import { RpcConfig } from '../types/common';



export class Rpc {
    protected client: AxiosInstance;

    constructor(config: RpcConfig) {
        this.client = axios.create({
            baseURL: config.url,

            auth: {
                username: config.username,
                password: config.password,
            },
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async call<T = any>(method: string, params: any[] = [], path?: string): Promise<T> {
        const payload = {
            jsonrpc: '2.0',
            id: 'rpc',
            method,
            params,
        };

        // Use path if provided, else default to root ''
        const url = path ? path : '';

        const response = await this.client.post(url, payload);

        if (response.data.error) {
            throw new Error(JSON.stringify(response.data.error));
        }

        return response.data.result;
    }

}
