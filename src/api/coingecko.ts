import axios from 'axios';
import { appConfig } from '../config';

export class CoinGeckoProvider {
    private readonly baseUrl = appConfig.coingecko.base;

    async getBtcPriceUSD(): Promise<number> {
        const res = await axios.get(
            `${this.baseUrl}/simple/price?ids=bitcoin&vs_currencies=usd`
        );
        return res.data.bitcoin.usd;
    }

    async convertSatsToUsd(sats: number): Promise<number> {
        const btc = sats / 1e8;
        const price = await this.getBtcPriceUSD();
        return btc * price;
    }

    async convertUsdToSats(usd: number): Promise<number> {
        const price = await this.getBtcPriceUSD();
        return Math.floor((usd / price) * 1e8);
    }
}
