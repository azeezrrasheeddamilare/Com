// Admin Dashboard Page
const AdminDashboardPage = {
    user: null,
    refreshInterval: null,

    async render(container, user) {
        this.user = user;
        
        container.innerHTML = `
            <div class="card page">
                ${Components.header(this.user, 'admin')}
                
                <h2 class="page-title">Admin Dashboard</h2>
                
                <div class="admin-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; border-bottom: 2px solid var(--border); padding-bottom: 10px;">
                    <button class="tab-btn active" onclick="AdminDashboardPage.showTab('stats')">📊 Statistics</button>
                    <button class="tab-btn" onclick="AdminDashboardPage.showTab('users')">👥 Users</button>
                    <button class="tab-btn" onclick="AdminDashboardPage.showTab('withdrawals')">📤 Withdrawals</button>
                    <button class="tab-btn" onclick="AdminDashboardPage.showTab('logs')">📜 Audit Logs</button>
                </div>
                
                <div id="admin-content" style="min-height: 400px;">
                    <div class="loading-spinner-small"></div>
                </div>
            </div>
        `;
        
        // Show stats tab by default
        await this.showTab('stats');
        
        // Start auto-refresh
        this.startAutoRefresh();
    },

    async showTab(tab) {
        const content = document.getElementById('admin-content');
        if (!content) return;
        
        content.innerHTML = '<div class="loading-spinner-small"></div>';
        
        // Update tab buttons
        document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Find and activate the clicked tab
        const tabs = document.querySelectorAll('.admin-tabs .tab-btn');
        for (let btn of tabs) {
            if (btn.textContent.includes(tab === 'stats' ? 'Statistics' : 
                                         tab === 'users' ? 'Users' : 
                                         tab === 'withdrawals' ? 'Withdrawals' : 'Logs')) {
                btn.classList.add('active');
                break;
            }
        }
        
        try {
            switch(tab) {
                case 'stats':
                    await this.showStats(content);
                    break;
                case 'users':
                    await this.showUsers(content);
                    break;
                case 'withdrawals':
                    await this.showWithdrawals(content);
                    break;
                case 'logs':
                    await this.showLogs(content);
                    break;
            }
        } catch (error) {
            console.error('Admin tab error:', error);
            content.innerHTML = '<div class="empty-state error">Failed to load data</div>';
        }
    },

    async showStats(container) {
        const data = await API.request('/api/admin/stats');
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px;">
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-details">
                        <div class="stat-label">Total Users</div>
                        <div class="stat-value">${data.stats.total_users}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">👑</div>
                    <div class="stat-details">
                        <div class="stat-label">Admins</div>
                        <div class="stat-value">${data.stats.total_admins}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📥</div>
                    <div class="stat-details">
                        <div class="stat-label">Deposits</div>
                        <div class="stat-value">${data.stats.total_deposits}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📤</div>
                    <div class="stat-details">
                        <div class="stat-label">Withdrawals</div>
                        <div class="stat-value">${data.stats.total_withdrawals}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🔄</div>
                    <div class="stat-details">
                        <div class="stat-label">Transfers</div>
                        <div class="stat-value">${data.stats.total_transfers || 0}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-details">
                        <div class="stat-label">Deposit Amount</div>
                        <div class="stat-value">$${Utils.safeToFixed(data.stats.total_deposit_amount, 2)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💸</div>
                    <div class="stat-details">
                        <div class="stat-label">Withdrawal Amount</div>
                        <div class="stat-value">$${Utils.safeToFixed(data.stats.total_withdrawal_amount, 2)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⚖️</div>
                    <div class="stat-details">
                        <div class="stat-label">Fees Collected</div>
                        <div class="stat-value">$${Utils.safeToFixed(data.stats.total_fees_collected, 2)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">◎</div>
                    <div class="stat-details">
                        <div class="stat-label">Total SOL</div>
                        <div class="stat-value">${Utils.safeToFixed(data.stats.total_sol_balance, 4)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💵</div>
                    <div class="stat-details">
                        <div class="stat-label">Total USDC</div>
                        <div class="stat-value">$${Utils.safeToFixed(data.stats.total_usdc_balance, 2)}</div>
                    </div>
                </div>
            </div>
            
            <h3 style="margin: 30px 0 15px;">Recent Activity</h3>
            <div class="transaction-list" style="max-height: 400px;">
                ${data.recentActivity.length === 0 ? '<div class="empty-state">No recent activity</div>' : 
                data.recentActivity.map(item => `
                    <div class="transaction-item" style="border-left-color: ${item.type === 'deposit' ? '#10b981' : item.type === 'withdrawal' ? '#f59e0b' : '#6366f1'};">
                        <div class="transaction-icon">${item.type === 'deposit' ? '📥' : item.type === 'withdrawal' ? '📤' : '↔️'}</div>
                        <div class="transaction-details">
                            <div class="transaction-type">${item.type.toUpperCase()} · ${item.asset}</div>
                            <div class="transaction-time">${Utils.formatDateTime(item.created_at)}</div>
                        </div>
                        <div class="transaction-amount">${item.amount}</div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    async showUsers(container) {
        const users = await API.request('/api/admin/users');
        
        container.innerHTML = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--light);">
                            <th style="padding: 12px; text-align: left;">Username</th>
                            <th style="padding: 12px; text-align: left;">Email</th>
                            <th style="padding: 12px; text-align: right;">SOL</th>
                            <th style="padding: 12px; text-align: right;">USDC</th>
                            <th style="padding: 12px; text-align: center;">Admin</th>
                            <th style="padding: 12px; text-align: left;">Created</th>
                            <th style="padding: 12px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 12px;">@${user.username}</td>
                                <td style="padding: 12px;">${user.email}</td>
                                <td style="padding: 12px; text-align: right;">${Utils.safeToFixed(user.sol_balance, 4)}</td>
                                <td style="padding: 12px; text-align: right;">${Utils.safeToFixed(user.usdc_balance, 2)}</td>
                                <td style="padding: 12px; text-align: center;">${user.is_admin ? '✅' : '❌'}</td>
                                <td style="padding: 12px;">${Utils.formatDate(user.created_at)}</td>
                                <td style="padding: 12px;">
                                    <button class="btn btn-small" style="padding: 6px 12px; font-size: 12px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="AdminDashboardPage.toggleAdmin('${user.id}', ${user.is_admin})">
                                        ${user.is_admin ? 'Remove Admin' : 'Make Admin'}
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async showWithdrawals(container) {
        const withdrawals = await API.request('/api/admin/withdrawals/pending');
        
        if (withdrawals.length === 0) {
            container.innerHTML = '<div class="empty-state">No pending withdrawals</div>';
            return;
        }
        
        container.innerHTML = `
            <h3>Pending Withdrawals</h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--light);">
                            <th style="padding: 12px;">User</th>
                            <th style="padding: 12px;">Asset</th>
                            <th style="padding: 12px; text-align: right;">Amount</th>
                            <th style="padding: 12px; text-align: right;">Fee</th>
                            <th style="padding: 12px;">Address</th>
                            <th style="padding: 12px;">Date</th>
                            <th style="padding: 12px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${withdrawals.map(w => `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 12px;">@${w.username}</td>
                                <td style="padding: 12px;">${w.asset}</td>
                                <td style="padding: 12px; text-align: right;">${w.amount}</td>
                                <td style="padding: 12px; text-align: right;">${w.fee}</td>
                                <td style="padding: 12px;"><code>${Utils.formatAddress(w.to_address)}</code></td>
                                <td style="padding: 12px;">${Utils.formatDate(w.created_at)}</td>
                                <td style="padding: 12px;">
                                    <button class="btn btn-success btn-small" style="padding: 6px 12px; margin-right: 5px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="AdminDashboardPage.approveWithdrawal('${w.id}')">✓ Approve</button>
                                    <button class="btn btn-danger btn-small" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="AdminDashboardPage.rejectWithdrawal('${w.id}')">✗ Reject</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async showLogs(container) {
        const logs = await API.request('/api/admin/logs');
        
        if (logs.length === 0) {
            container.innerHTML = '<div class="empty-state">No admin logs yet</div>';
            return;
        }
        
        container.innerHTML = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--light);">
                            <th style="padding: 12px;">Admin</th>
                            <th style="padding: 12px;">Action</th>
                            <th style="padding: 12px;">Details</th>
                            <th style="padding: 12px;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 12px;">@${log.admin_username}</td>
                                <td style="padding: 12px;">${log.action}</td>
                                <td style="padding: 12px;"><code style="font-size: 11px; background: #f0f0f0; padding: 4px; border-radius: 4px;">${log.details}</code></td>
                                <td style="padding: 12px;">${Utils.formatDateTime(log.created_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async toggleAdmin(userId, currentStatus) {
        try {
            await API.request(`/api/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ is_admin: currentStatus ? 0 : 1 })
            });
            Utils.showNotification('success', `Admin status updated`);
            this.showTab('users');
        } catch (error) {
            Utils.handleError(error);
        }
    },

    async approveWithdrawal(withdrawalId) {
        if (!confirm('Approve this withdrawal?')) return;
        
        try {
            await API.request(`/api/admin/withdrawals/${withdrawalId}/approve`, {
                method: 'POST'
            });
            Utils.showNotification('success', 'Withdrawal approved');
            this.showTab('withdrawals');
        } catch (error) {
            Utils.handleError(error);
        }
    },

    async rejectWithdrawal(withdrawalId) {
        if (!confirm('Reject this withdrawal? Funds will be returned to user.')) return;
        
        try {
            await API.request(`/api/admin/withdrawals/${withdrawalId}/reject`, {
                method: 'POST'
            });
            Utils.showNotification('success', 'Withdrawal rejected');
            this.showTab('withdrawals');
        } catch (error) {
            Utils.handleError(error);
        }
    },

    startAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        
        this.refreshInterval = setInterval(() => {
            const activeTab = document.querySelector('.admin-tabs .tab-btn.active');
            if (activeTab) {
                const tabText = activeTab.textContent;
                if (tabText.includes('Statistics')) this.showTab('stats');
                else if (tabText.includes('Users')) this.showTab('users');
                else if (tabText.includes('Withdrawals')) this.showTab('withdrawals');
                else if (tabText.includes('Logs')) this.showTab('logs');
            }
        }, 30000);
    },

    cleanup() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
};

window.AdminDashboardPage = AdminDashboardPage;

// Add admin route to router
const originalGoTo = Router.goTo;
Router.goTo = async function(page, data = {}) {
    if (page === 'admin') {
        if (!data.user || !data.user.is_admin) {
            Utils.showNotification('error', 'Admin access required');
            return;
        }
        await AdminDashboardPage.render(this.container, data.user);
        this.currentPage = page;
        window.location.hash = page;
        Utils.hideLoading();
        return;
    }
    return originalGoTo.call(this, page, data);
};
