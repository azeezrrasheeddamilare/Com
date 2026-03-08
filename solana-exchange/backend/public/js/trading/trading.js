// Trading UI JavaScript
let currentAsset = 'SOL/USDT';
let currentVolume = 0.01;
let currentBid = 0;
let currentAsk = 0;
let currentMid = 0;
let tradingBalance = 0;
let mainUSDC = 0;
let positions = [];
let chart = null;

// Contract specifications
const CONTRACTS = {
    'BTC/USDT': { size: 1, tickValue: 1 },
    'ETH/USDT': { size: 20, tickValue: 0.2 },
    'ETC/USDT': { size: 1000, tickValue: 1 },
    'SOL/USDT': { size: 100, tickValue: 0.1 }
};

// TradingView symbols
const TV_SYMBOLS = {
    'BTC/USDT': 'BINANCE:BTCUSDT',
    'ETH/USDT': 'BINANCE:ETHUSDT',
    'ETC/USDT': 'BINANCE:ETCUSDT',
    'SOL/USDT': 'BINANCE:SOLUSDT'
};

// ============================================
// Initialize page
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 Trading page loaded');
    
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }
    
    // Set user info
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        document.getElementById('userName').textContent = payload.username || 'User';
        document.getElementById('userAvatar').textContent = 
            (payload.username || 'U')[0].toUpperCase();
    } catch (e) {}
    
    // Initialize chart
    initChart('SOL/USDT');
    
    // Load initial data
    await loadBalances();
    await loadPositions();
    await fetchPrices();
    
    // Set up WebSocket listeners
    if (window.tradingWS) {
        window.tradingWS.onPriceUpdate((prices) => {
            updatePrices(prices);
        });
        
        window.tradingWS.onPositionUpdate((updatedPositions) => {
            updatePositions(updatedPositions);
        });
    }
    
    // Set up periodic refresh as fallback
    setInterval(() => {
        if (!window.tradingWS || window.tradingWS.ws?.readyState !== WebSocket.OPEN) {
            console.log('Fallback: fetching prices via HTTP');
            fetchPrices();
            loadPositions();
        }
    }, 5000);
    
    // Initial calculation
    calculateOrder();
});

// ============================================
// Chart functions
// ============================================
function initChart(asset) {
    const container = document.getElementById('tradingview_chart');
    if (!container) return;
    
    container.innerHTML = '';
    
    chart = new TradingView.widget({
        "container_id": "tradingview_chart",
        "width": "100%",
        "height": "100%",
        "symbol": TV_SYMBOLS[asset],
        "interval": "1",
        "timezone": "exchange",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#f1f3f6",
        "enable_publishing": false,
        "allow_symbol_change": false,
        "save_image": false,
        "studies": [
            "RSI@tv-basicstudies",
            "MASimple@tv-basicstudies"
        ]
    });
}

function switchAsset(asset) {
    currentAsset = asset;
    
    // Update tabs
    document.querySelectorAll('.asset-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent === asset) tab.classList.add('active');
    });
    
    // Update chart
    initChart(asset);
    
    // Fetch prices
    fetchPrices();
}

// ============================================
// Price functions with spread
// ============================================
async function fetchPrices() {
    try {
        const response = await fetch(`/api/trading/prices/${currentAsset}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentBid = data.data.bid;
            currentAsk = data.data.ask;
            currentMid = data.data.mid;
            
            // Update display
            document.getElementById('currentPrice').textContent = 
                `$${currentMid.toFixed(2)}`;
            document.getElementById('bidPrice').textContent = 
                `$${currentBid.toFixed(2)}`;
            document.getElementById('askPrice').textContent = 
                `$${currentAsk.toFixed(2)}`;
            
            calculateOrder();
        }
    } catch (error) {
        console.error('Price fetch error:', error);
    }
}

function updatePrices(prices) {
    if (prices[currentAsset]) {
        const oldMid = currentMid;
        currentBid = prices[currentAsset].bid;
        currentAsk = prices[currentAsset].ask;
        currentMid = prices[currentAsset].mid;
        
        // Update displays
        document.getElementById('currentPrice').textContent = 
            `$${currentMid.toFixed(2)}`;
        document.getElementById('bidPrice').textContent = 
            `$${currentBid.toFixed(2)}`;
        document.getElementById('askPrice').textContent = 
            `$${currentAsk.toFixed(2)}`;
        
        // Show price change
        if (oldMid && oldMid !== currentMid) {
            const change = currentMid - oldMid;
            const changePercent = (change / oldMid) * 100;
            
            const changeEl = document.getElementById('priceChange');
            if (changeEl) {
                changeEl.textContent = `${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                changeEl.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
            }
            
            // Flash effect
            const priceEl = document.getElementById('currentPrice');
            priceEl.style.transition = 'color 0.3s';
            priceEl.style.color = change >= 0 ? '#16C784' : '#EA3943';
            setTimeout(() => {
                priceEl.style.color = 'white';
            }, 300);
        }
        
        calculateOrder();
    }
}

// ============================================
// Balance functions
// ============================================
async function loadBalances() {
    try {
        const response = await fetch('/api/trading/balance', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            tradingBalance = data.data.tradingUSDC;
            mainUSDC = data.data.mainUSDC;
            
            document.getElementById('tradingBalance').textContent = 
                `$${tradingBalance.toFixed(2)}`;
            document.getElementById('mainUSDC').textContent = 
                `$${mainUSDC.toFixed(2)}`;
            document.getElementById('modalAvailable').textContent = 
                `$${mainUSDC.toFixed(2)}`;
        }
    } catch (error) {
        console.error('Balance load error:', error);
    }
}

function showTransferModal() {
    document.getElementById('transferModal').classList.add('active');
}

function closeTransferModal() {
    document.getElementById('transferModal').classList.remove('active');
    document.getElementById('transferAmount').value = '';
}

async function confirmTransfer() {
    const amount = parseFloat(document.getElementById('transferAmount').value);
    
    if (!amount || amount <= 0) {
        showNotification('error', 'Invalid amount');
        return;
    }
    
    if (amount > mainUSDC) {
        showNotification('error', 'Insufficient balance');
        return;
    }
    
    try {
        const response = await fetch('/api/trading/balance/transfer-to-trading', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ amount })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('success', data.message);
            closeTransferModal();
            await loadBalances();
        } else {
            showNotification('error', data.error);
        }
    } catch (error) {
        showNotification('error', 'Transfer failed');
    }
}

// ============================================
// Order functions with spread
// ============================================
function setVolume(vol) {
    currentVolume = vol;
    
    document.querySelectorAll('.volume-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseFloat(btn.textContent) === vol) btn.classList.add('active');
    });
    
    calculateOrder();
}

function calculateOrder() {
    const contract = CONTRACTS[currentAsset];
    if (!contract) return;
    
    // Calculate using ASK price for BUY, BID price for SELL
    const positionValue = currentVolume * contract.size * currentMid;
    const margin = positionValue / 100; // 1:100 leverage
    const fee = currentVolume * 15;
    const total = margin + fee;
    
    document.getElementById('margin').textContent = `$${margin.toFixed(2)}`;
    document.getElementById('fee').textContent = `$${fee.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
    
    // Update buy/sell buttons with current prices
    document.getElementById('buyBtn').innerHTML = `BUY $${currentAsk.toFixed(2)}`;
    document.getElementById('sellBtn').innerHTML = `SELL $${currentBid.toFixed(2)}`;
}

async function placeOrder(side) {
    const total = parseFloat(document.getElementById('total').textContent.replace('$', ''));
    
    if (tradingBalance < total) {
        showNotification('error', `Insufficient balance. Need $${total.toFixed(2)}`);
        return;
    }
    
    // Use appropriate price based on side
    const orderPrice = side === 'BUY' ? currentAsk : currentBid;
    
    try {
        const response = await fetch('/api/trading/orders/open', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                asset: currentAsset,
                volume: currentVolume,
                side,
                price: orderPrice
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('success', `Opened ${currentVolume} ${currentAsset} ${side} at $${orderPrice.toFixed(2)}`);
            await loadBalances();
            await loadPositions();
        } else {
            showNotification('error', data.error);
        }
    } catch (error) {
        console.error('Order error:', error);
        showNotification('error', 'Order failed - check console');
    }
}

// ============================================
// Position functions
// ============================================
async function loadPositions() {
    try {
        const response = await fetch('/api/trading/orders/positions', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            positions = data.data;
            renderPositions();
        }
    } catch (error) {
        console.error('Position load error:', error);
        showNotification('error', 'Failed to load positions');
    }
}

function updatePositions(updatedPositions) {
    // Filter positions for current user
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userPositions = updatedPositions.filter(p => p.user_id === payload.id);
        
        if (userPositions.length > 0) {
            userPositions.forEach(newPos => {
                const index = positions.findIndex(p => p.id === newPos.id);
                if (index >= 0) {
                    // Update existing position (keep entry price unchanged)
                    positions[index] = {
                        ...positions[index],
                        current_price: newPos.current_price,
                        pnl: newPos.pnl
                    };
                } else {
                    // Add new position
                    positions.push(newPos);
                }
            });
            
            renderPositions();
        }
    } catch (error) {
        console.error('Update positions error:', error);
    }
}

function renderPositions() {
    const container = document.getElementById('positionsList');
    
    if (positions.length === 0) {
        container.innerHTML = `
            <div style="color: #8E8E93; text-align: center; padding: 40px; grid-column: 1/-1;">
                No open positions
            </div>
        `;
        return;
    }
    
    container.innerHTML = positions.map(pos => {
        const pnl = pos.pnl || 0;
        const pnlClass = pnl >= 0 ? 'profit' : 'loss';
        const pnlSymbol = pnl >= 0 ? '+' : '-';
        const currentPrice = pos.current_price || pos.entry_price;
        
        return `
            <div class="position-card ${pnlClass}" data-position-id="${pos.id}">
                <div class="position-header">
                    <span class="position-asset">${pos.asset}</span>
                    <span class="position-side ${pos.side}">${pos.side}</span>
                </div>
                <div class="position-details">
                    <div>Volume: ${pos.volume}</div>
                    <div>Entry: $${pos.entry_price.toFixed(2)}</div>
                    <div>Current: $${currentPrice.toFixed(2)}</div>
                </div>
                <div class="position-pnl ${pnlClass}">
                    P&L: ${pnlSymbol}$${Math.abs(pnl).toFixed(2)}
                </div>
                <button class="close-btn" onclick="closePosition('${pos.id}')">
                    Close Position
                </button>
            </div>
        `;
    }).join('');
}

async function closePosition(positionId) {
    if (!confirm('Close this position?')) return;
    
    try {
        console.log('Closing position:', positionId);
        
        const response = await fetch('/api/trading/orders/close', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ positionId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('success', data.message);
            await loadBalances();
            await loadPositions();
        } else {
            showNotification('error', data.error || 'Failed to close position');
        }
    } catch (error) {
        console.error('Close position error:', error);
        showNotification('error', 'Failed to close position - check console');
    }
}

// ============================================
// UI Helpers
// ============================================
function showNotification(type, message) {
    if (window.tradingWS) {
        window.tradingWS.showNotification(type, message);
    } else {
        alert(message);
    }
}

function logout() {
    if (window.tradingWS) {
        window.tradingWS.disconnect();
    }
    localStorage.removeItem('token');
    window.location.href = '/';
}

// Export functions for HTML onclick
window.switchAsset = switchAsset;
window.setVolume = setVolume;
window.placeOrder = placeOrder;
window.closePosition = closePosition;
window.showTransferModal = showTransferModal;
window.closeTransferModal = closeTransferModal;
window.confirmTransfer = confirmTransfer;
window.logout = logout;
