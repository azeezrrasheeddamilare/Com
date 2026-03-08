import { TransferList } from '../components/TransferList.js';
import { sendTransfer, getTransfers } from '../api/transfer.js';
import { showNotification } from '../services/notifications.js';
import { updateBalance } from '../services/balance.js';

export async function renderTransfer(container, user) {
    container.innerHTML = `
        <div class="transfer-container">
            <h2>Send to User</h2>
            
            <form id="transfer-form" class="transfer-form">
                <div class="form-group">
                    <label>Recipient Username</label>
                    <input type="text" id="transfer-username" placeholder="@username" required>
                </div>
                
                <div class="form-group">
                    <label>Amount</label>
                    <div class="amount-input-group">
                        <input type="number" id="transfer-amount" step="0.001" min="0.001" placeholder="0.00" required>
                        <select id="transfer-asset">
                            <option value="SOL">SOL</option>
                            <option value="USDC">USDC</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Memo (optional)</label>
                    <input type="text" id="transfer-memo" placeholder="What's this for?">
                </div>
                
                <button type="submit" class="transfer-submit-btn">Send</button>
            </form>
            
            <h3>Recent Transfers</h3>
            <div id="transfer-list" class="transfer-list">
                <div class="loading-spinner-small"></div>
            </div>
        </div>
    `;
    
    // Load transfer history
    await loadTransferHistory(user.id);
    
    // Handle form submit
    document.getElementById('transfer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const toUsername = document.getElementById('transfer-username').value;
        const amount = parseFloat(document.getElementById('transfer-amount').value);
        const asset = document.getElementById('transfer-asset').value;
        const memo = document.getElementById('transfer-memo').value;
        
        try {
            const data = await sendTransfer(toUsername, asset, amount, memo);
            showNotification('success', data.message);
            
            // Reset form
            document.getElementById('transfer-username').value = '';
            document.getElementById('transfer-amount').value = '';
            document.getElementById('transfer-memo').value = '';
            
            // Refresh data
            await loadTransferHistory(user.id);
            await updateBalance(user.id);
            
        } catch (err) {
            showNotification('error', err.message);
        }
    });
}

async function loadTransferHistory(userId) {
    try {
        const transfers = await getTransfers();
        const container = document.getElementById('transfer-list');
        container.innerHTML = TransferList({ transfers, currentUserId: userId });
    } catch (err) {
        showNotification('error', 'Failed to load transfers');
    }
}
