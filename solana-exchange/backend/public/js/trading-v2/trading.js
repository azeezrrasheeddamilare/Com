// ============================================
// TRADING V2 - Real-time prices, no defaults
// ============================================

// State
let currentAsset = 'SOL/USDT';
let currentVolume = 0.01;
let currentBid = 0;
let currentAsk = 0;
let tradingBalance = 0;
let mainUSDC = 0;
let positions = [];
let ws = null;
let chart = null;
let transferDirection = 'toTrading';

// Price cache for ALL assets
let assetPrices = {
    'BTC/USDT': { bid: 0, ask: 0, mid: 0 },
    'ETH/USDT': { bid: 0, ask: 0, mid: 0 },
    'ETC/USDT': { bid: 0, ask: 0, mid: 0 },
    'SOL/USDT': { bid: 0, ask: 0, mid: 0 }
};

const CONTRACTS = {
    'BTC/USDT': 1,
    'ETH/USDT': 20,
    'ETC/USDT': 1000,
    'SOL/USDT': 100
};

const TV_SYMBOLS = {
    'BTC/USDT': 'BINANCE:BTCUSDT',
    'ETH/USDT': 'BINANCE:ETHUSDT',
    'ETC/USDT': 'BINANCE:ETCUSDT',
    'SOL/USDT': 'BINANCE:SOLUSDT'
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        document.getElementById('userName').textContent = payload.username || 'User';
        document.getElementById('userAvatar').textContent = 
            (payload.username || 'U')[0].toUpperCase();
    } catch (e) {}

    initChart('SOL/USDT');
    await loadBalances();
    await loadPositions();
    await fetchAllPrices(); // Fetch ALL prices, not just current
    connectWebSocket();
    
    // Update prices every 2 seconds
    setInterval(fetchAllPrices, 2000);
    // Update P&L every second
    setInterval(updateAllPnL, 1000);
});

// ============================================
// WEBSOCKET
// ============================================
function connectWebSocket() {
    const token = localStorage.getItem('token');
    if (!token) return;

    ws = new WebSocket(`ws://${window.location.host}/ws-v2?token=${token}`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'PRICE_UPDATE') {
            updateAllPrices(data.data);
        }
    };

    ws.onclose = () => {
        setTimeout(connectWebSocket, 3000);
    };
}

// ============================================
// CHART
// ============================================
function initChart(asset) {
    const container = document.getElementById('tradingview_chart');
    container.innerHTML = '';
    
    chart = new TradingView.widget({
        container_id: 'tradingview_chart',
        width: '100%',
        height: '100%',
        symbol: TV_SYMBOLS[asset],
        interval: '1',
        timezone: 'exchange',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#f1f3f6',
        enable_publishing: false,
        allow_symbol_change: false,
        save_image: false,
        studies: ['RSI@tv-basicstudies']
    });
}

function switchAsset(asset) {
    currentAsset = asset;
    document.querySelectorAll('.asset-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent === asset.split('/')[0]) tab.classList.add('active');
    });
    initChart(asset);
    updateButtonPrices(); // Update buttons with cached prices
}

// ============================================
// PRICES - Fetch ALL assets at once
// ============================================
async function fetchAllPrices() {
    try {
        const response = await fetch('/api/trading-v2/prices', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const data = await response.json();
        if (data.success) {
            updateAllPrices(data.data);
        }
    } catch (error) {
        console.error('Price fetch error:', error);
    }
}

function updateAllPrices(prices) {
    // Update price cache for all assets
    for (let [asset, priceData] of Object.entries(prices)) {
        if (priceData.bid && priceData.ask) {
            assetPrices[asset] = {
                bid: priceData.bid,
                ask: priceData.ask,
                mid: (priceData.bid + priceData.ask) / 2
            };
        }
    }
    
    // Update current asset prices
    if (assetPrices[currentAsset]) {
        currentBid = assetPrices[currentAsset].bid;
        currentAsk = assetPrices[currentAsset].ask;
    }
    
    updateButtonPrices();
    calculateOrder();
    updateAllPnL(); // Update all positions P&L
}

function updateButtonPrices() {
    if (currentBid > 0 && currentAsk > 0) {
        document.getElementById('sellBtn').innerHTML = 'Sell $' + currentBid.toFixed(3);
        document.getElementById('buyBtn').innerHTML = 'Buy $' + currentAsk.toFixed(3);
        
        const spread = (currentAsk - currentBid).toFixed(3);
        document.getElementById('spread').textContent = spread;
    }
}

// ============================================
// BALANCE
// ============================================
async function loadBalances() {
    try {
        const response = await fetch('/api/trading-v2/balance', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const data = await response.json();
        
        if (data.success) {
            tradingBalance = data.data.tradingUSDC || 0;
            mainUSDC = data.data.mainUSDC || 0;
            
            document.getElementById('tradingBalance').textContent = '$' + tradingBalance.toFixed(2);
            document.getElementById('mainUSDC').textContent = '$' + mainUSDC.toFixed(2);
            document.getElementById('modalAvailable').textContent = '$' + mainUSDC.toFixed(2);
        }
    } catch (error) {
        console.error('Balance error:', error);
    }
}

// ============================================
// TRANSFER
// ============================================
function showTransferModal(direction) {
    transferDirection = direction;
    const title = direction === 'toTrading' ? 'Transfer to Trading' : 'Transfer to Main';
    document.getElementById('modalTitle').textContent = title;
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
    
    const endpoint = transferDirection === 'toTrading' 
        ? '/api/trading-v2/balance/to-trading' 
        : '/api/trading-v2/balance/to-main';
    
    try {
        const response = await fetch(endpoint, {
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
// VOLUME & ORDER
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
    if (currentBid > 0 && currentAsk > 0) {
        const price = (currentBid + currentAsk) / 2;
        const contractSize = CONTRACTS[currentAsset] || 1;
        const positionValue = currentVolume * contractSize * price;
        const margin = positionValue / 100;
        const fee = currentVolume * 15;
        const total = margin + fee;
        
        document.getElementById('margin').textContent = '$' + margin.toFixed(2);
        document.getElementById('fee').textContent = '$' + fee.toFixed(2);
        document.getElementById('total').textContent = '$' + total.toFixed(2);
        
        console.log('Order calculated:', {price, margin, fee, total});
    } else {
        document.getElementById('fee').textContent = '$' + (currentVolume * 15).toFixed(2);
    }
}

// ============================================
// ORDER PLACEMENT
// ============================================
async function placeOrder(side) {
    const total = parseFloat(document.getElementById('total').textContent.replace('$', ''));
    
    if (tradingBalance < total) {
        showNotification('error', 'Insufficient balance');
        return;
    }
    
    try {
        const response = await fetch('/api/trading-v2/orders/open', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                asset: currentAsset,
                volume: currentVolume,
                side
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('success', data.message);
            await loadBalances();
            await loadPositions();
        } else {
            showNotification('error', data.error);
        }
    } catch (error) {
        showNotification('error', 'Order failed');
    }
}

// ============================================
// POSITIONS - REAL-TIME P&L
// ============================================
async function loadPositions() {
    try {
        const response = await fetch('/api/trading-v2/orders/positions', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const data = await response.json();
        
        if (data.success) {
            positions = data.data || [];
            renderPositions();
        }
    } catch (error) {
        console.error('Positions error:', error);
    }
}

// Calculate real-time P&L for a position
function calculatePositionPnL(position) {
    const assetPrice = assetPrices[position.asset];
    if (!assetPrice || !assetPrice.mid) return 0;
    
    const currentPrice = assetPrice.mid;
    let priceDiff = currentPrice - position.entry_price;
    
    if (position.side === 'SELL') {
        priceDiff = -priceDiff;
    }
    
    const contractSize = CONTRACTS[position.asset] || 1;
    return priceDiff * position.volume * contractSize;
}

// Update all positions P&L
function updateAllPnL() {
    if (positions.length === 0) return;
    renderPositions();
}

function renderPositions() {
    const container = document.getElementById('positionsList');
    
    if (positions.length === 0) {
        container.innerHTML = '<div style="color: #8E8E93; text-align: center; padding: 40px;">No open positions</div>';
        return;
    }
    
    container.innerHTML = positions.map(pos => {
        // Calculate real-time P&L
        const pnl = calculatePositionPnL(pos);
        const pnlClass = pnl >= 0 ? 'profit' : 'loss';
        const pnlSymbol = pnl >= 0 ? '+' : '-';
        
        // Get current price for this asset
        const currentPrice = assetPrices[pos.asset]?.mid || pos.entry_price;
        
        return `
            <div class="position-card ${pnlClass}">
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
                <button class="close-btn" onclick="closePosition('${pos.id}')">Close</button>
            </div>
        `;
    }).join('');
}

async function closePosition(positionId) {
    if (!confirm('Close this position?')) return;
    
    try {
        const response = await fetch('/api/trading-v2/orders/close', {
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
            showNotification('error', data.error);
        }
    } catch (error) {
        showNotification('error', 'Close failed');
    }
}

// ============================================
// UI HELPERS
// ============================================
function toggleUserMenu() {
    if (confirm('Logout?')) {
        logout();
    }
}

function showNotification(type, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function logout() {
    if (ws) ws.close();
    localStorage.removeItem('token');
    window.location.href = '/';
}

// Make functions global
window.switchAsset = switchAsset;
window.setVolume = setVolume;
window.placeOrder = placeOrder;
window.closePosition = closePosition;
window.showTransferModal = showTransferModal;
window.closeTransferModal = closeTransferModal;
window.confirmTransfer = confirmTransfer;
window.toggleUserMenu = toggleUserMenu;
window.logout = logout;