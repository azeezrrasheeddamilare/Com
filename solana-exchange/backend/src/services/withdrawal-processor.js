const db = require('../lib/database');

const Withdrawal = db.Withdrawal;
const Transaction = db.Transaction;

class WithdrawalProcessor {
    constructor() {
        this.isProcessing = false;
        this.checkInterval = null;
    }
    
    start() {
        console.log('💰 Withdrawal processor started');
        
        if (this.checkInterval) clearInterval(this.checkInterval);
        this.checkInterval = setInterval(() => this.processWithdrawals(), 60000);
    }
    
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    
    async processWithdrawals() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        
        try {
            const pending = await Withdrawal.findPending();
            
            for (const withdrawal of pending) {
                await Withdrawal.updateStatus(withdrawal.id, 'completed', `sim_${Date.now()}`);
                await Transaction.create(
                    withdrawal.user_id,
                    'withdrawal',
                    withdrawal.asset,
                    withdrawal.amount,
                    withdrawal.fee,
                    `sim_${Date.now()}`,
                    withdrawal.to_address
                );
                console.log(`✅ Withdrawal processed: ${withdrawal.id}`);
            }
        } catch (error) {
            console.error('Withdrawal error:', error.message);
        } finally {
            this.isProcessing = false;
        }
    }
}

module.exports = new WithdrawalProcessor();
