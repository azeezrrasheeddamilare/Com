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
