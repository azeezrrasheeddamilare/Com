import { TransactionList } from '../components/TransactionList.js';
import { getTransactions } from '../api/transactions.js';
import { showNotification } from '../services/notifications.js';

export async function renderHistory(container) {
    container.innerHTML = `
        <div class="history-container">
            <h2>Transaction History</h2>
            <div id="transaction-list" class="transaction-list">
                <div class="loading-spinner-small"></div>
            </div>
        </div>
    `;
    
    try {
        const transactions = await getTransactions();
        document.getElementById('transaction-list').innerHTML = TransactionList({ transactions });
    } catch (err) {
        showNotification('error', 'Failed to load transactions');
    }
}
