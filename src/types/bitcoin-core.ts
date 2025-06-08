export type BitcoinCoreClientConfig = {
    headers?: Record<string, string>;
    host?: string;
    logger?: any;
    password?: string;
    timeout?: number;
    username?: string;
    version?: string;
    wallet?: string;
    allowDefaultWallet?: boolean;
}

