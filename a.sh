cd /workspaces/Com/solana-exchange/backend

# Fix the API response mapping
cat > public/js/pages/dashboard.js << 'EOF'
// Dashboard Page
const DashboardPage = {
    user: null,
    refreshInterval: null,

    async render(container, user) {
        this.user = user;
        
        // Get fresh user data
        try {
            const freshUser = await API.user.get(user.id);
            // Map API response to expected format
            this.user = { 
                ...user, 
                ...freshUser,
                // Ensure balances have default values
                solBalance: freshUser.sol_balance ?? freshUser.solBalance ?? 0,
                usdcBalance: freshUser.usdc_balance ?? freshUser.usdcBalance ?? 0,
                depositAddress: freshUser.deposit_address ?? freshUser.depositAddress ?? 'Address not available'
            };
        } catch (error) {
            Utils.handleError(error);
            // Use provided user data as fallback
            this.user = {
                ...user,
                solBalance: user.solBalance ?? 0,
                usdcBalance: user.usdcBalance ?? 0,
                depositAddress: user.depositAddress ?? 'Address not available'
            };
        }

        container.innerHTML = `
            <div class="card page">
                ${Components.header(this.user, 'dashboard')}
                ${Components.balanceCards(this.user)}
                ${Components.addressCard(this.user.depositAddress)}
                
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
                            <div class="stat-value" id="portfolio-value">$${((this.user.solBalance * AppConfig.SOL_PRICE) + this.user.usdcBalance).toFixed(2)}</div>
                        </div>
                    </div>
                </div>
                
                <div class="recent-activity">
                    <h3>Recent Activity</h3>
                    <div id="recent-activity" class="transaction-list">
                        <div class="loading-spinner-small"></div>
                    </div>
                </div>
            </div>
        `;

        // Load recent activity
        this.loadRecentActivity();

        // Start auto-refresh
        this.startAutoRefresh();
    },

    async loadRecentActivity() {
        try {
            const transactions = await API.transactions.getAll();
            const recent = transactions.slice(0, 5);
            
            const container = document.getElementById('recent-activity');
            
            if (recent.length === 0) {
                container.innerHTML = '<div class="empty-state">No recent activity</div>';
                return;
            }

            container.innerHTML = recent.map(tx => {
                const sign = tx.type.includes('deposit') ? '+' : '-';
                const color = tx.type.includes('deposit') ? '#10b981' : '#f59e0b';
                
                return `
                    <div class="transaction-item" style="border-left-color: ${color}">
                        <div class="transaction-icon">${tx.type.includes('deposit') ? '📥' : '📤'}</div>
                        <div class="transaction-details">
                            <div class="transaction-type">${tx.type.toUpperCase()} · ${tx.asset}</div>
                            <div class="transaction-time">${Utils.formatDateTime(tx.created_at)}</div>
                        </div>
                        <div class="transaction-amount ${tx.type}">
                            ${sign}${tx.amount} ${tx.asset}
                        </div>
                    </div>
                `;
            }).join('');

            // Update stats
            const totalDeposits = transactions
                .filter(t => t.type.includes('deposit'))
                .reduce((sum, t) => sum + t.amount, 0);
            const totalWithdrawals = transactions
                .filter(t => t.type.includes('withdrawal'))
                .reduce((sum, t) => sum + t.amount, 0);
            
            document.getElementById('total-deposits').textContent = `$${totalDeposits.toFixed(2)}`;
            document.getElementById('total-withdrawals').textContent = `$${totalWithdrawals.toFixed(2)}`;

        } catch (error) {
            console.error('Failed to load recent activity:', error);
            document.getElementById('recent-activity').innerHTML = '<div class="empty-state error">Failed to load</div>';
        }
    },

    startAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        
        this.refreshInterval = setInterval(async () => {
            try {
                const freshUser = await API.user.get(this.user.id);
                this.user = { 
                    ...this.user, 
                    ...freshUser,
                    solBalance: freshUser.sol_balance ?? freshUser.solBalance ?? this.user.solBalance,
                    usdcBalance: freshUser.usdc_balance ?? freshUser.usdcBalance ?? this.user.usdcBalance,
                };
                
                // Update balance displays
                document.getElementById('sol-balance').textContent = Utils.formatAmount(this.user.solBalance, 'SOL');
                document.getElementById('usdc-balance').textContent = Utils.formatAmount(this.user.usdcBalance, 'USDC');
                document.getElementById('sol-usd').textContent = `$${(this.user.solBalance * AppConfig.SOL_PRICE).toFixed(2)}`;
                document.getElementById('usdc-usd').textContent = `$${this.user.usdcBalance.toFixed(2)}`;
                document.getElementById('portfolio-value').textContent = `$${((this.user.solBalance * AppConfig.SOL_PRICE) + this.user.usdcBalance).toFixed(2)}`;
                
            } catch (error) {
                console.error('Auto-refresh failed:', error);
            }
        }, AppConfig.REFRESH_INTERVAL);
    },

    cleanup() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
};

window.Pages = window.Pages || {};
window.Pages.dashboard = DashboardPage;
EOF

# Also fix the utils.js formatAmount function
cat > public/js/core/utils.js << 'EOF'
// Utility Functions
const Utils = {
    // Format address
    formatAddress: (address) => {
        if (!address) return '';
        if (address.length < 12) return address;
        return `${address.slice(0, 6)}...${address.slice(-6)}`;
    },

    // Format date
    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    },

    // Format time
    formatTime: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString();
    },

    // Format datetime
    formatDateTime: (dateString) => {
        const date = new Date(dateString);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    },

    // Calculate fee
    calculateFee: (amount) => {
        const fee = amount * AppConfig.FEE_PERCENT;
        return Math.min(fee, AppConfig.MAX_FEE);
    },

    // Format amount with decimals (safe version)
    formatAmount: (amount, asset) => {
        // Ensure amount is a number
        const num = parseFloat(amount) || 0;
        const decimals = AppConfig.ASSETS[asset]?.decimals || 4;
        return num.toFixed(decimals);
    },

    // Safe number formatting
    safeToFixed: (value, decimals = 2) => {
        const num = parseFloat(value) || 0;
        return num.toFixed(decimals);
    },

    // Show loading
    showLoading: () => {
        document.getElementById('loading').style.display = 'flex';
    },

    // Hide loading
    hideLoading: () => {
        document.getElementById('loading').style.display = 'none';
    },

    // Show notification
    showNotification: (type, message) => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${type === 'success' ? '✅' : '❌'}</span>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 5000);
    },

    // Handle error
    handleError: (error) => {
        console.error('Error:', error);
        Utils.showNotification('error', error.message || 'An error occurred');
    }
};

window.Utils = Utils;
EOF

# Fix the common.js balanceCards function
cat > public/js/components/common.js << 'EOF'
// Common Components
const Components = {
    // Header with dropdown menu
    header: (user, currentPage = 'dashboard') => {
        const firstLetter = user.username ? user.username[0].toUpperCase() : 'U';
        
        return `
            <div class="header">
                <div class="logo">
                    <span class="logo-icon">◎</span>
                    <span class="logo-text">Solana Exchange</span>
                </div>
                
                <div class="user-menu" id="user-menu">
                    <div class="user-button" onclick="Components.toggleDropdown()">
                        <div class="user-avatar">${firstLetter}</div>
                        <span class="user-name">@${user.username}</span>
                        <span class="dropdown-icon">▼</span>
                    </div>
                    
                    <div class="dropdown-menu" id="dropdown-menu">
                        <div class="dropdown-item ${currentPage === 'dashboard' ? 'active' : ''}" onclick="Router.goTo('dashboard', {user})">
                            <span class="item-icon">📊</span>
                            <span>Dashboard</span>
                        </div>
                        <div class="dropdown-item ${currentPage === 'transfer' ? 'active' : ''}" onclick="Router.goTo('transfer', {user})">
                            <span class="item-icon">↔️</span>
                            <span>Transfer</span>
                        </div>
                        <div class="dropdown-item ${currentPage === 'withdraw' ? 'active' : ''}" onclick="Router.goTo('withdraw', {user})">
                            <span class="item-icon">📤</span>
                            <span>Withdraw</span>
                        </div>
                        <div class="dropdown-item ${currentPage === 'history' ? 'active' : ''}" onclick="Router.goTo('history', {user})">
                            <span class="item-icon">📜</span>
                            <span>History</span>
                        </div>
                        <div class="dropdown-item logout" onclick="Auth.logout()">
                            <span class="item-icon">🚪</span>
                            <span>Logout</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Toggle dropdown menu
    toggleDropdown: () => {
        const menu = document.getElementById('user-menu');
        menu.classList.toggle('active');
    },

    // Close dropdown when clicking outside
    setupDropdownClose: () => {
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('user-menu');
            const button = document.querySelector('.user-button');
            
            if (menu && button && !button.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.remove('active');
            }
        });
    },

    // Balance cards (safe version)
    balanceCards: (user) => {
        // Ensure balances are numbers
        const solBalance = parseFloat(user.solBalance) || 0;
        const usdcBalance = parseFloat(user.usdcBalance) || 0;
        
        return `
            <div class="balance-grid">
                <div class="balance-card sol" onclick="Router.goTo('withdraw', {user, asset: 'SOL'})">
                    <div class="balance-icon">◎</div>
                    <div class="balance-label">SOL Balance</div>
                    <div class="balance-amount" id="sol-balance">${solBalance.toFixed(4)}</div>
                    <div class="balance-usd" id="sol-usd">$${(solBalance * AppConfig.SOL_PRICE).toFixed(2)}</div>
                </div>
                <div class="balance-card usdc" onclick="Router.goTo('withdraw', {user, asset: 'USDC'})">
                    <div class="balance-icon">💵</div>
                    <div class="balance-label">USDC Balance</div>
                    <div class="balance-amount" id="usdc-balance">${usdcBalance.toFixed(2)}</div>
                    <div class="balance-usd" id="usdc-usd">$${usdcBalance.toFixed(2)}</div>
                </div>
            </div>
        `;
    },

    // Address card
    addressCard: (address) => `
        <div class="address-card">
            <div class="address-label">Your Deposit Address</div>
            <div class="address-container">
                <code class="address-code">${address || 'Loading...'}</code>
                <button class="copy-btn" onclick="Components.copyAddress('${address}')">Copy</button>
            </div>
            <div class="address-note">Send only SOL or USDC to this address</div>
        </div>
    `,

    // Copy address
    copyAddress: async (address) => {
        if (!address || address === 'Loading...') {
            Utils.showNotification('error', 'Address not available');
            return;
        }
        await navigator.clipboard.writeText(address);
        Utils.showNotification('success', 'Address copied!');
    },

    // Asset selector for withdraw page
    assetSelector: (selectedAsset) => `
        <div class="asset-selector">
            <button class="asset-btn ${selectedAsset === 'SOL' ? 'active' : ''}" onclick="Pages.withdraw.selectAsset('SOL')">
                ◎ SOL
            </button>
            <button class="asset-btn ${selectedAsset === 'USDC' ? 'active' : ''}" onclick="Pages.withdraw.selectAsset('USDC')">
                💵 USDC
            </button>
        </div>
    `,

    // Withdraw info box
    withdrawInfo: (asset, available, amount = 0) => {
        const safeAvailable = parseFloat(available) || 0;
        const safeAmount = parseFloat(amount) || 0;
        const fee = Utils.calculateFee(safeAmount);
        const receive = safeAmount - fee;
        
        return `
            <div class="withdraw-info">
                <div class="info-row">
                    <span>Available Balance:</span>
                    <span>${safeAvailable.toFixed(4)} ${asset}</span>
                </div>
                <div class="info-row">
                    <span>Fee (0.1%):</span>
                    <span id="withdraw-fee">${fee.toFixed(4)} ${asset}</span>
                </div>
                <div class="info-row total">
                    <span>You will receive:</span>
                    <span id="withdraw-receive">${receive.toFixed(4)} ${asset}</span>
                </div>
            </div>
        `;
    }
};

// Initialize dropdown close listener
document.addEventListener('DOMContentLoaded', () => {
    Components.setupDropdownClose();
});

window.Components = Components;
EOF

# Restart server
./start.sh

echo "✅ Balance error fixed!"
echo "🔄 Server restarted"
echo "📱 Refresh your browser"