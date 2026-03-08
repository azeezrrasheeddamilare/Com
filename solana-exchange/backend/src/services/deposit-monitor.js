const { Connection, PublicKey } = require('@solana/web3.js');
const { getHDWallet, USDC_MINT } = require('../lib/hdwallet');
const db = require('../lib/database');

const User = db.User;
const Deposit = db.Deposit;
const Transaction = db.Transaction;

class DepositMonitor {
    constructor() {
        this.connection = new Connection('https://api.devnet.solana.com');
        this.hdWallet = getHDWallet();
        this.processedSignatures = new Set();
        this.isRunning = false;
        this.checkInterval = null;
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        console.log('🚀 Deposit monitor started');
        
        // Clear any existing interval
        if (this.checkInterval) clearInterval(this.checkInterval);
        
        // Set new interval
        this.checkInterval = setInterval(() => this.checkDeposits(), 30000);
        this.checkDeposits();
    }
    
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isRunning = false;
        console.log('🛑 Deposit monitor stopped');
    }
    
    async checkDeposits() {
        try {
            const users = await User.getAll();
            if (users.length === 0) return;
            
            // Check only first user each time to reduce load
            const user = users[Math.floor(Math.random() * users.length)];
            await this.checkUserDeposits(user);
            
        } catch (error) {
            // Silent fail
        }
    }
    
    async checkUserDeposits(user) {
        try {
            const pubkey = new PublicKey(user.deposit_address);
            const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit: 2 });
            
            for (const sig of signatures) {
                if (this.processedSignatures.has(sig.signature)) continue;
                
                const tx = await this.connection.getParsedTransaction(sig.signature, {
                    maxSupportedTransactionVersion: 0
                });
                
                if (!tx) continue;
                
                await this.processSOLDeposit(user, tx, sig.signature);
                this.processedSignatures.add(sig.signature);
            }
        } catch (error) {}
    }
    
    async processSOLDeposit(user, tx, signature) {
        if (!tx.meta || !tx.transaction.message.instructions) return;
        
        for (const ix of tx.transaction.message.instructions) {
            if (ix.program === 'system' && ix.parsed?.type === 'transfer') {
                const { destination, lamports, source } = ix.parsed.info;
                
                if (destination === user.deposit_address) {
                    const amount = lamports / 1e9;
                    
                    const existing = await Deposit.findBySignature(signature);
                    if (!existing) {
                        await Deposit.create(user.id, 'SOL', amount, signature, source, destination);
                        await User.updateBalance(user.id, 'SOL', amount);
                        await Transaction.create(
                            user.id, 
                            'deposit', 
                            'SOL', 
                            amount, 
                            0, 
                            signature, 
                            destination, 
                            source
                        );
                        console.log(`✅ Deposit: ${amount} SOL`);
                    }
                }
            }
        }
    }
}

module.exports = new DepositMonitor();
