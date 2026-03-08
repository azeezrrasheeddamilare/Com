// Dashboard State
let balanceInterval = null;
let transactionsInterval = null;
let currentTab = 'dashboard';
let selectedAsset = 'SOL';

// ========== TAB NAVIGATION ==========
function showTab(tabName) {
    currentTab = tabName;
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show selected tab
    document.getElementById(`tab-${tabName}`).style.display = 'block';
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');
    
    // Load data if needed
    if (tabName === 'history') {
        loadTransactions();
    } else if (tabName === 'withdraw') {
        updateBalance();
        updateAvailableBalance();
    }
}

// ========== COPY ADDRESS ==========
async function copyAddress() {
    const address = document.getElementById('deposit-address').textContent;
    await navigator.clipboard.writeText(address);
    
    const btn = document.querySelector('.copy-btn');
    const original = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    setTimeout(() => { btn.innerHTML = original; }, 2000);
}

// ========== BALANCE UPDATES ==========
async function updateBalance() {
    if (!window.currentUser) return;
    
    try {
        console.log('🔄 Fetching latest balance...');
        const user = await API.getUser(window.currentUser.id);
        
        // Update SOL balance
        const solBalance = user.sol_balance || 0;
        document.getElementById('sol-balance').textContent = solBalance.toFixed(4);
        document.getElementById('sol-usd').textContent = `$${(solBalance * 100).toFixed(2)}`;
        
        // Update USDC balance
        const usdcBalance = user.usdc_balance || 0;
        document.getElementById('usdc-balance').textContent = usdcBalance.toFixed(2);
        document.getElementById('usdc-usd').textContent = `$${usdcBalance.toFixed(2)}`;
        
        // Update portfolio value
        const portfolio = (solBalance * 100) + usdcBalance;
        document.getElementById('portfolio-value').textContent = `$${portfolio.toFixed(2)}`;
        
        console.log(`✅ Balance updated - SOL: ${solBalance}, USDC: ${usdcBalance}`);
        
        // Update stored user data
        window.currentUser.solBalance = solBalance;
        window.currentUser.usdcBalance = usdcBalance;
        
    } catch (err) {
        console.error('Balance update failed:', err);
    }
}

function updateAvailableBalance() {
    const solBalance = parseFloat(document.getElementById('sol-balance').textContent) || 0;
    const usdcBalance = parseFloat(document.getElementById('usdc-balance').textContent) || 0;
    const available = selectedAsset === 'SOL' ? solBalance : usdcBalance;
    document.getElementById('available-balance').textContent = `${available.toFixed(4)} ${selectedAsset}`;
}

// ========== ASSET SELECTION ==========
function selectAsset(asset) {
    selectedAsset = asset;
    document.querySelectorAll('.asset-selector-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.asset-selector-btn[data-asset="${asset}"]`).classList.add('active');
    document.getElementById('withdraw-asset-display').textContent = asset;
    updateAvailableBalance();
    updateFee();
}

// ========== WITHDRAWAL ==========
function updateFee() {
    const amount = parseFloat(document.getElementById('withdraw-amount').value) || 0;
    const fee = amount * 0.001;
    const receive = amount - fee;
    
    document.getElementById('withdraw-fee').textContent = `${fee.toFixed(4)} ${selectedAsset}`;
    document.getElementById('receive-amount').textContent = `${receive.toFixed(4)} ${selectedAsset}`;
}

async function handleWithdraw(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const address = document.getElementById('withdraw-address').value;
    
    if (!amount || amount <= 0) {
        showNotification('error', 'Please enter a valid amount');
        return;
    }
    
    if (!address) {
        showNotification('error', 'Please enter a destination address');
        return;
    }
    
    // Basic address validation
    if (address.length < 32 || address.length > 44) {
        showNotification('error', 'Invalid Solana address format');
        return;
    }
    
    window.showLoading();
    
    try {
        const endpoint = selectedAsset === 'SOL' ? '/api/withdraw/sol' : '/api/withdraw/usdc';
        const data = await API.request(endpoint, {
            method: 'POST',
            body: JSON.stringify({ amount, toAddress: address })
        });
        
        showNotification('success', `Withdrawal request created! Amount: ${data.withdrawal.amount} ${selectedAsset}`);
        
        // Reset form
        document.getElementById('withdraw-amount').value = '';
        document.getElementById('withdraw-address').value = '';
        
        // Update balance and switch to history tab
        await updateBalance();
        showTab('history');
        await loadTransactions();
        
    } catch (err) {
        showNotification('error', `Withdrawal failed: ${err.message}`);
    } finally {
        window.hideLoading();
    }
}

// ========== NOTIFICATIONS ==========
function showNotification(type, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
            <span class="notification-message">${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">✕</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// ========== TRANSACTION HISTORY ==========
async function loadTransactions() {
    if (!window.currentUser) return;
    
    const container = document.getElementById('transaction-list');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner-small"></div>';
    
    try {
        const transactions = await API.getTransactions();
        console.log(`📜 Loaded ${transactions.length} transactions`);
        
        if (transactions.length === 0) {
            container.innerHTML = '<div class="empty-state">📭 No transactions yet</div>';
            return;
        }
        
        // Group by date
        const grouped = {};
        transactions.forEach(tx => {
            const date = new Date(tx.created_at).toLocaleDateString();
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(tx);
        });
        
        let html = '';
        for (const [date, txs] of Object.entries(grouped)) {
            html += `<div class="transaction-date-header">${date}</div>`;
            
            txs.forEach(tx => {
                const time = new Date(tx.created_at).toLocaleTimeString();
                const sign = tx.type === 'deposit' ? '+' : '-';
                const color = tx.type === 'deposit' ? '#10b981' : '#f59e0b';
                
                html += `
                    <div class="transaction-card" style="border-left-color: ${color}">
                        <div class="transaction-icon">${tx.type === 'deposit' ? '📥' : '📤'}</div>
                        <div class="transaction-details">
                            <div class="transaction-type">
                                ${tx.type.toUpperCase()} · ${tx.asset}
                                ${tx.status && tx.status !== 'completed' ? `<span class="transaction-status ${tx.status}">${tx.status}</span>` : ''}
                            </div>
                            <div class="transaction-time">${time}</div>
                            ${tx.tx_signature ? `
                                <div class="transaction-tx">
                                    ${tx.tx_signature.slice(0, 8)}...${tx.tx_signature.slice(-8)}
                                </div>
                            ` : ''}
                        </div>
                        <div class="transaction-amount ${tx.type}">
                            ${sign}${tx.amount} ${tx.asset}
                            ${tx.fee > 0 ? `<div class="transaction-fee">fee: ${tx.fee}</div>` : ''}
                        </div>
                    </div>
                `;
            });
        }
        
        container.innerHTML = html;
        
        // Update stats
        const totalDeposits = transactions
            .filter(t => t.type === 'deposit')
            .reduce((sum, t) => sum + t.amount, 0);
        const totalWithdrawals = transactions
            .filter(t => t.type === 'withdrawal')
            .reduce((sum, t) => sum + t.amount, 0);
        
        document.getElementById('total-deposits').textContent = `${totalDeposits.toFixed(2)} USD`;
        document.getElementById('total-withdrawals').textContent = `${totalWithdrawals.toFixed(2)} USD`;
        
    } catch (err) {
        console.error('Failed to load transactions:', err);
        container.innerHTML = '<div class="empty-state error">❌ Failed to load transactions</div>';
    }
}

// ========== LOGOUT ==========
function logout() {
    localStorage.removeItem('token');
    window.currentUser = null;
    if (balanceInterval) clearInterval(balanceInterval);
    if (transactionsInterval) clearInterval(transactionsInterval);
    window.renderAuth();
}

// ========== MAIN RENDER ==========
function renderDashboard() {
    const app = document.getElementById('app');
    
    app.innerHTML = `
        <div class="dashboard">
            <!-- Header -->
            <div class="dashboard-header">
                <div>
                    <h1 class="dashboard-title">Solana Exchange</h1>
                    <div class="user-info">
                        <span class="user-avatar">👤</span>
                        <span class="username">@${window.currentUser.username}</span>
                        <span class="user-email">${window.currentUser.email}</span>
                    </div>
                </div>
                <button onclick="logout()" class="logout-btn">Logout</button>
            </div>
            
            <!-- Balance Cards -->
            <div class="balance-cards">
                <div class="balance-card sol" onclick="selectAsset('SOL'); showTab('withdraw')">
                    <div class="balance-icon">◎</div>
                    <div class="balance-info">
                        <div class="balance-label">SOL Balance</div>
                        <div class="balance-amount" id="sol-balance">${window.currentUser.solBalance || 0}</div>
                        <div class="balance-usd" id="sol-usd">$${((window.currentUser.solBalance || 0) * 100).toFixed(2)}</div>
                    </div>
                </div>
                
                <div class="balance-card usdc" onclick="selectAsset('USDC'); showTab('withdraw')">
                    <div class="balance-icon">💵</div>
                    <div class="balance-info">
                        <div class="balance-label">USDC Balance</div>
                        <div class="balance-amount" id="usdc-balance">${window.currentUser.usdcBalance || 0}</div>
                        <div class="balance-usd" id="usdc-usd">$${(window.currentUser.usdcBalance || 0).toFixed(2)}</div>
                    </div>
                </div>
            </div>
            
            <!-- Deposit Address -->
            <div class="deposit-section">
                <h3>Deposit Address</h3>
                <div class="address-container">
                    <code class="address-code" id="deposit-address">${window.currentUser.depositAddress}</code>
                    <button onclick="copyAddress()" class="copy-btn">📋 Copy</button>
                </div>
                <p class="address-note">Send only SOL or USDC to this address</p>
            </div>
            
            <!-- Tab Navigation -->
            <div class="tab-navigation">
                <button class="tab-button active" data-tab="dashboard" onclick="showTab('dashboard')">
                    <span class="tab-icon">📊</span>
                    <span class="tab-label">Dashboard</span>
                </button>
                <button class="tab-button" data-tab="withdraw" onclick="showTab('withdraw')">
                    <span class="tab-icon">📤</span>
                    <span class="tab-label">Withdraw</span>
                </button>
                <button class="tab-button" data-tab="history" onclick="showTab('history')">
                    <span class="tab-icon">📜</span>
                    <span class="tab-label">History</span>
                </button>
            </div>
            
            <!-- Tab Contents -->
            <div class="tab-contents">
                <!-- Dashboard Tab -->
                <div id="tab-dashboard" class="tab-content">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">📥</div>
                            <div class="stat-details">
                                <div class="stat-label">Total Deposits</div>
                                <div class="stat-value" id="total-deposits">Loading...</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📤</div>
                            <div class="stat-details">
                                <div class="stat-label">Total Withdrawals</div>
                                <div class="stat-value" id="total-withdrawals">Loading...</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">💰</div>
                            <div class="stat-details">
                                <div class="stat-label">Portfolio Value</div>
                                <div class="stat-value" id="portfolio-value">$${(((window.currentUser.solBalance || 0) * 100) + (window.currentUser.usdcBalance || 0)).toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="recent-activity">
                        <h3>Recent Activity</h3>
                        <div id="recent-activity" class="activity-list">
                            <div class="loading-spinner-small"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Withdraw Tab -->
                <div id="tab-withdraw" class="tab-content" style="display:none;">
                    <div class="withdraw-container">
                        <h2>Withdraw Funds</h2>
                        
                        <div class="asset-selector">
                            <button class="asset-selector-btn active" data-asset="SOL" onclick="selectAsset('SOL')">
                                <span class="asset-icon">◎</span>
                                <span class="asset-name">SOL</span>
                            </button>
                            <button class="asset-selector-btn" data-asset="USDC" onclick="selectAsset('USDC')">
                                <span class="asset-icon">💵</span>
                                <span class="asset-name">USDC</span>
                            </button>
                        </div>
                        
                        <form onsubmit="handleWithdraw(event)" class="withdraw-form">
                            <div class="form-group">
                                <label>Amount (<span id="withdraw-asset-display">SOL</span>)</label>
                                <input 
                                    type="number" 
                                    id="withdraw-amount" 
                                    placeholder="0.00" 
                                    step="0.001" 
                                    min="0.001"
                                    oninput="updateFee()"
                                    required
                                >
                            </div>
                            
                            <div class="form-group">
                                <label>Destination Address</label>
                                <input 
                                    type="text" 
                                    id="withdraw-address" 
                                    placeholder="Enter Solana address (e.g., 8x3d...)"
                                    required
                                >
                            </div>
                            
                            <div class="withdraw-info">
                                <div class="info-row">
                                    <span>Available Balance:</span>
                                    <span class="info-value" id="available-balance">${(window.currentUser.solBalance || 0).toFixed(4)} SOL</span>
                                </div>
                                <div class="info-row">
                                    <span>Fee (0.1%):</span>
                                    <span class="info-value" id="withdraw-fee">0.0000 SOL</span>
                                </div>
                                <div class="info-row total">
                                    <span>You will receive:</span>
                                    <span class="info-value" id="receive-amount">0 SOL</span>
                                </div>
                            </div>
                            
                            <div class="form-actions">
                                <button type="submit" class="withdraw-submit-btn">Withdraw</button>
                                <button type="button" class="cancel-btn" onclick="showTab('dashboard')">Cancel</button>
                            </div>
                        </form>
                        
                        <div class="withdraw-note">
                            <span class="note-icon">⏱️</span>
                            <span>Withdrawals are processed every 30 seconds. Double-check the address!</span>
                        </div>
                    </div>
                </div>
                
                <!-- History Tab -->
                <div id="tab-history" class="tab-content" style="display:none;">
                    <div class="history-container">
                        <h2>Transaction History</h2>
                        <div id="transaction-list" class="transaction-list">
                            <div class="loading-spinner-small"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initial data load
    updateBalance();
    loadRecentActivity();
    
    // Start auto-refresh every 5 seconds for balances
    if (balanceInterval) clearInterval(balanceInterval);
    balanceInterval = setInterval(updateBalance, 5000);
    
    if (transactionsInterval) clearInterval(transactionsInterval);
    transactionsInterval = setInterval(loadRecentActivity, 30000);
}

// ========== RECENT ACTIVITY ==========
async function loadRecentActivity() {
    if (!window.currentUser) return;
    
    const container = document.getElementById('recent-activity');
    if (!container) return;
    
    try {
        const transactions = await API.getTransactions();
        const recent = transactions.slice(0, 5);
        
        if (recent.length === 0) {
            container.innerHTML = '<div class="empty-state">No recent activity</div>';
            return;
        }
        
        container.innerHTML = recent.map(tx => {
            const date = new Date(tx.created_at).toLocaleDateString();
            const sign = tx.type === 'deposit' ? '+' : '-';
            return `
                <div class="activity-item">
                    <span class="activity-icon">${tx.type === 'deposit' ? '📥' : '📤'}</span>
                    <span class="activity-type">${tx.type}</span>
                    <span class="activity-asset">${tx.asset}</span>
                    <span class="activity-amount ${tx.type}">${sign}${tx.amount}</span>
                    <span class="activity-date">${date}</span>
                </div>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Failed to load recent activity:', err);
        container.innerHTML = '<div class="empty-state error">Failed to load activity</div>';
    }
}

// Make functions global
window.showTab = showTab;
window.copyAddress = copyAddress;
window.selectAsset = selectAsset;
window.handleWithdraw = handleWithdraw;
window.updateFee = updateFee;
window.logout = logout;
window.renderDashboard = renderDashboard;
window.showNotification = showNotification;
