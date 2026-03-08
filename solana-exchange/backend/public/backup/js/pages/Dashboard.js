import { BalanceCard } from '../components/BalanceCard.js';
import { TransactionList } from '../components/TransactionList.js';
import { getTransactions } from '../api/transactions.js';
import { updateBalance } from '../services/balance.js';
import { showNotification } from '../services/notifications.js';

export async function renderDashboard(container, user, onTabChange) {
    const balances = await updateBalance(user.id);
    
    container.innerHTML = `
        <div class="dashboard">
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
                        <div class="stat-value" id="portfolio-value">$${((balances?.sol || 0) * 100 + (balances?.usdc || 0)).toFixed(2)}</div>
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
    `;
    
    // Load recent transactions
    try {
        const transactions = await getTransactions();
        const recent = transactions.slice(0, 5);
        document.getElementById('recent-activity').innerHTML = TransactionList({ transactions: recent });
    } catch (err) {
        showNotification('error', 'Failed to load recent activity');
    }
}
