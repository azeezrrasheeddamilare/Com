// WebSocket Client for Real-time Updates
class TradingWebSocket {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnect = 5;
        this.callbacks = new Map();
        this.positionUpdateCallbacks = [];
        this.priceUpdateCallbacks = [];
    }
    
    connect() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('No token, WebSocket not connected');
            return;
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
        
        console.log('🔌 Connecting to WebSocket...');
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket connected');
            this.reconnectAttempts = 0;
            document.body.dispatchEvent(new CustomEvent('wsConnected'));
            
            // Request initial data
            this.send({ type: 'REQUEST_PRICES' });
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('❌ WebSocket disconnected');
            this.reconnect();
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    
    handleMessage(data) {
        // Dispatch event for other scripts
        document.body.dispatchEvent(new CustomEvent('wsMessage', { detail: data }));
        
        switch(data.type) {
            case 'INIT':
                this.handleInit(data.data);
                break;
                
            case 'PRICE_UPDATE':
                this.handlePriceUpdate(data.data);
                break;
                
            case 'POSITION_UPDATE':
                this.handlePositionUpdate(data.data);
                break;
                
            case 'LIQUIDATION':
                this.handleLiquidation(data.data);
                break;
        }
    }
    
    handleInit(data) {
        console.log('📊 Received initial data:', data);
        
        // Update balances
        if (data.tradingBalance !== undefined) {
            this.updateElement('tradingBalance', `$${data.tradingBalance.toFixed(2)}`);
            window.tradingBalance = data.tradingBalance;
        }
        
        if (data.mainUSDC !== undefined) {
            this.updateElement('mainUSDC', `$${data.mainUSDC.toFixed(2)}`);
            this.updateElement('modalAvailable', `$${data.mainUSDC.toFixed(2)}`);
        }
        
        // Update prices
        if (data.prices) {
            window.dispatchEvent(new CustomEvent('pricesUpdate', { detail: data.prices }));
            this.priceUpdateCallbacks.forEach(cb => cb(data.prices));
        }
        
        // Update positions
        if (data.positions) {
            this.positionUpdateCallbacks.forEach(cb => cb(data.positions));
        }
    }
    
    handlePriceUpdate(prices) {
        // Update current price display
        if (window.currentAsset && prices[window.currentAsset]) {
            const price = prices[window.currentAsset];
            const priceEl = document.getElementById('currentPrice');
            
            if (priceEl) {
                const oldPrice = parseFloat(priceEl.textContent.replace('$', ''));
                priceEl.textContent = `$${price.toFixed(2)}`;
                
                // Calculate and show change
                if (oldPrice && oldPrice !== price) {
                    const change = price - oldPrice;
                    const changePercent = (change / oldPrice) * 100;
                    
                    const changeEl = document.getElementById('priceChange');
                    if (changeEl) {
                        changeEl.textContent = `${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                        changeEl.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
                    }
                    
                    // Flash the price
                    priceEl.style.transition = 'color 0.3s';
                    priceEl.style.color = change >= 0 ? '#16C784' : '#EA3943';
                    setTimeout(() => {
                        priceEl.style.color = 'white';
                    }, 300);
                }
            }
            
            // Recalculate order
            if (window.calculateOrder) {
                window.currentPrice = price;
                window.calculateOrder();
            }
        }
        
        // Notify all callbacks
        this.priceUpdateCallbacks.forEach(cb => cb(prices));
        window.dispatchEvent(new CustomEvent('pricesUpdate', { detail: prices }));
    }
    
    handlePositionUpdate(positions) {
        console.log('📈 Position update received:', positions);
        this.positionUpdateCallbacks.forEach(cb => cb(positions));
    }
    
    handleLiquidation(data) {
        console.log('💀 Liquidation:', data);
        
        // Show notification
        this.showNotification(
            'error',
            `⚠️ LIQUIDATION: Your ${data.asset} position has been liquidated. Loss: $${data.loss}`
        );
        
        // Reload positions after short delay
        setTimeout(() => {
            if (window.loadPositions) {
                window.loadPositions();
            }
        }, 1000);
    }
    
    updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
    
    showNotification(type, message) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            z-index: 1001;
            animation: slideIn 0.3s;
            background: ${type === 'error' ? '#EA3943' : type === 'success' ? '#16C784' : '#F0B90B'};
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
    
    onPriceUpdate(callback) {
        this.priceUpdateCallbacks.push(callback);
    }
    
    onPositionUpdate(callback) {
        this.positionUpdateCallbacks.push(callback);
    }
    
    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnect) return;
        
        this.reconnectAttempts++;
        setTimeout(() => {
            console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts})`);
            this.connect();
        }, 2000 * this.reconnectAttempts);
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Create global instance
window.tradingWS = new TradingWebSocket();

// Auto-connect on trading page
if (window.location.pathname === '/trading.html') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => window.tradingWS.connect(), 500);
    });
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
