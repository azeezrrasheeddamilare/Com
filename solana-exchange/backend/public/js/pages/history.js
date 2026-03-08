// History Page
const HistoryPage = {
    user: null,

    async render(container, user) {
        this.user = user;

        container.innerHTML = `
            <div class="card page">
                ${Components.header(this.user, 'history')}
                
                <h2 class="page-title">Transaction History</h2>
                
                <div id="transaction-list" class="transaction-list">
                    <div class="loading-spinner-small"></div>
                </div>
            </div>
        `;

        await this.loadTransactions();
    },

    async loadTransactions() {
        try {
            const transactions = await API.transactions.getAll();
            const container = document.getElementById('transaction-list');
            
            if (transactions.length === 0) {
                container.innerHTML = '<div class="empty-state">No transactions yet</div>';
                return;
            }

            // Group by date
            const grouped = {};
            transactions.forEach(tx => {
                const date = Utils.formatDate(tx.created_at);
                if (!grouped[date]) grouped[date] = [];
                grouped[date].push(tx);
            });

            let html = '';
            for (const [date, txs] of Object.entries(grouped)) {
                html += `<div class="transaction-date-header">${date}</div>`;
                
                txs.forEach(tx => {
                    const sign = tx.type.includes('deposit') ? '+' : '-';
                    const color = tx.type.includes('deposit') ? '#10b981' : '#f59e0b';
                    
                    html += `
                        <div class="transaction-item" style="border-left-color: ${color}">
                            <div class="transaction-icon">${tx.type.includes('deposit') ? '📥' : '📤'}</div>
                            <div class="transaction-details">
                                <div class="transaction-type">${tx.type.toUpperCase()} · ${tx.asset}</div>
                                <div class="transaction-time">${Utils.formatTime(tx.created_at)}</div>
                                ${tx.tx_signature ? `<div class="transaction-tx">${Utils.formatAddress(tx.tx_signature)}</div>` : ''}
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

        } catch (error) {
            console.error('Failed to load transactions:', error);
            document.getElementById('transaction-list').innerHTML = '<div class="empty-state error">Failed to load transactions</div>';
        }
    }
};

window.Pages = window.Pages || {};
window.Pages.history = HistoryPage;
