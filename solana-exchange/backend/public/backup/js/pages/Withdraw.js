import { withdrawSOL, withdrawUSDC } from '../api/withdraw.js';
import { showNotification } from '../services/notifications.js';
import { calculateFee } from '../services/utils.js';
import { updateBalance } from '../services/balance.js';

export function renderWithdraw(container, user) {
    container.innerHTML = `
        <div class="withdraw-container">
            <h2>Withdraw Funds</h2>
            
            <div class="asset-selector">
                <button class="asset-selector-btn active" data-asset="SOL">◎ SOL</button>
                <button class="asset-selector-btn" data-asset="USDC">💵 USDC</button>
            </div>
            
            <form id="withdraw-form" class="withdraw-form">
                <div class="form-group">
                    <label>Amount (<span id="withdraw-asset-display">SOL</span>)</label>
                    <input type="number" id="withdraw-amount" step="0.001" min="0.001" required>
                </div>
                
                <div class="form-group">
                    <label>Destination Address</label>
                    <input type="text" id="withdraw-address" placeholder="Enter Solana address" required>
                </div>
                
                <div class="withdraw-info">
                    <div class="info-row">
                        <span>Available:</span>
                        <span id="available-balance">${user.solBalance.toFixed(4)} SOL</span>
                    </div>
                    <div class="info-row">
                        <span>Fee (0.1%):</span>
                        <span id="withdraw-fee">0.0000 SOL</span>
                    </div>
                    <div class="info-row total">
                        <span>You receive:</span>
                        <span id="receive-amount">0 SOL</span>
                    </div>
                </div>
                
                <button type="submit" class="withdraw-submit-btn">Withdraw</button>
            </form>
        </div>
    `;
    
    let selectedAsset = 'SOL';
    
    // Asset selector
    document.querySelectorAll('.asset-selector-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.asset-selector-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedAsset = btn.dataset.asset;
            document.getElementById('withdraw-asset-display').textContent = selectedAsset;
            
            const balance = selectedAsset === 'SOL' ? user.solBalance : user.usdcBalance;
            document.getElementById('available-balance').textContent = `${balance.toFixed(4)} ${selectedAsset}`;
            updateFee();
        });
    });
    
    // Amount input
    document.getElementById('withdraw-amount').addEventListener('input', updateFee);
    
    function updateFee() {
        const amount = parseFloat(document.getElementById('withdraw-amount').value) || 0;
        const fee = calculateFee(amount);
        const receive = amount - fee;
        
        document.getElementById('withdraw-fee').textContent = `${fee.toFixed(4)} ${selectedAsset}`;
        document.getElementById('receive-amount').textContent = `${receive.toFixed(4)} ${selectedAsset}`;
    }
    
    // Form submit
    document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const amount = parseFloat(document.getElementById('withdraw-amount').value);
        const address = document.getElementById('withdraw-address').value;
        
        try {
            const withdrawFn = selectedAsset === 'SOL' ? withdrawSOL : withdrawUSDC;
            await withdrawFn(amount, address);
            
            showNotification('success', 'Withdrawal request created!');
            
            document.getElementById('withdraw-amount').value = '';
            document.getElementById('withdraw-address').value = '';
            
            await updateBalance(user.id);
            
        } catch (err) {
            showNotification('error', err.message);
        }
    });
}
