const fetch = require('node-fetch');

class PriceOracle {
    constructor() {
        this.prices = {
            'BTC/USDT': { bid: 0, ask: 0, mid: 0 },
            'ETH/USDT': { bid: 0, ask: 0, mid: 0 },
            'ETC/USDT': { bid: 0, ask: 0, mid: 0 },
            'SOL/USDT': { bid: 0, ask: 0, mid: 0 }
        };
        
        // Spread amounts (platform profit)
        this.spreads = {
            'BTC/USDT': 10.00,
            'ETH/USDT': 0.96,
            'ETC/USDT': 0.011,
            'SOL/USDT': 0.059
        };
        
        this.updateInterval = 2000; // 2 seconds
        this.isRunning = false;
        this.updateCallbacks = [];
        
        this.binanceSymbols = {
            'BTC/USDT': 'BTCUSDT',
            'ETH/USDT': 'ETHUSDT',
            'ETC/USDT': 'ETCUSDT',
            'SOL/USDT': 'SOLUSDT'
        };
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        console.log('📊 Price oracle started');
        this.updatePrices();
        setInterval(() => this.updatePrices(), this.updateInterval);
    }
    
    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }
    
    async updatePrices() {
        try {
            for (let [asset, symbol] of Object.entries(this.binanceSymbols)) {
                const midPrice = await this.fetchBinancePrice(symbol);
                if (midPrice) {
                    const spread = this.spreads[asset] || 0;
                    const bid = midPrice - (spread / 2);
                    const ask = midPrice + (spread / 2);
                    
                    this.prices[asset] = {
                        bid: Number(bid.toFixed(2)),
                        ask: Number(ask.toFixed(2)),
                        mid: midPrice
                    };
                }
            }
            
            // Notify all callbacks
            this.updateCallbacks.forEach(cb => cb(this.prices));
            
        } catch (error) {
            console.error('Price oracle error:', error.message);
        }
    }
    
    async fetchBinancePrice(symbol) {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
            const data = await response.json();
            return data.price ? parseFloat(data.price) : null;
        } catch (error) {
            console.error(`Failed to fetch ${symbol}:`, error.message);
            return null;
        }
    }
    
    getPrice(asset, type = 'mid') {
        return this.prices[asset] ? this.prices[asset][type] : 0;
    }
    
    getAllPrices() {
        return { ...this.prices };
    }
}

module.exports = new PriceOracle();
