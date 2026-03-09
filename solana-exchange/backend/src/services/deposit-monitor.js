const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getHDWallet, USDC_MINT } = require('../lib/hdwallet');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
const db = require('../lib/database');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const User = db.User;
const Deposit = db.Deposit;

class DepositMonitor {
    constructor() {
        this.connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
        this.hdWallet = getHDWallet();
        this.processedSignatures = new Set();
        this.isRunning = false;
        this.checkInterval = 15000; // 15 seconds
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        console.log('🚀 Deposit monitor started - watching for deposits');
        this.checkAllUsers();
        setInterval(() => this.checkAllUsers(), this.checkInterval);
    }
    
    async checkAllUsers() {
        try {
            const users = await User.getAll();
            
            for (const user of users) {
                await this.checkUserDeposits(user);
            }
            
        } catch (error) {
            console.error('Monitor error:', error.message);
        }
    }
    
    async checkUserDeposits(user) {
        try {
            // Get user's deposit address from HD wallet
            let userAddress;
            try {
                const userWallet = this.hdWallet.deriveUserAddress(user.wallet_index);
                userAddress = userWallet.publicKey;
            } catch (error) {
                console.error(`   ⚠️  Could not derive address for user ${user.id}: ${error.message}`);
                return;
            }
            
            // Get recent transactions
            const pubkey = new PublicKey(userAddress);
            const signatures = await this.connection.getSignaturesForAddress(
                pubkey, 
                { limit: 5 }
            );
            
            for (const sig of signatures) {
                if (this.processedSignatures.has(sig.signature)) continue;
                
                // Check if already in database
                const existing = await this.checkExistingDeposit(sig.signature);
                if (existing) {
                    this.processedSignatures.add(sig.signature);
                    continue;
                }
                
                // Get transaction details
                const tx = await this.connection.getParsedTransaction(sig.signature, {
                    maxSupportedTransactionVersion: 0
                });
                
                if (!tx || !tx.meta) continue;
                
                await this.processSOLTransfer(user, tx, sig.signature, userAddress);
                this.processedSignatures.add(sig.signature);
            }
            
        } catch (error) {
            if (!error.message.includes('429')) {
                console.error(`   Error checking user ${user.id}:`, error.message);
            }
        }
    }
    
    async checkExistingDeposit(signature) {
        return new Promise((resolve) => {
            const db = new sqlite3.Database(path.join(__dirname, '../../database.sqlite'));
            db.get(
                'SELECT id FROM deposits WHERE tx_signature = ?',
                [signature],
                (err, row) => {
                    db.close();
                    resolve(!!row);
                }
            );
        });
    }
    
    async processSOLTransfer(user, tx, signature, expectedAddress) {
        if (!tx.meta || !tx.transaction.message.instructions) return false;
        
        for (const ix of tx.transaction.message.instructions) {
            if (ix.program === 'system' && ix.parsed?.type === 'transfer') {
                const { destination, lamports, source } = ix.parsed.info;
                
                if (destination === expectedAddress) {
                    const amount = lamports / LAMPORTS_PER_SOL;
                    
                    console.log(`\n💰 SOL DEPOSIT DETECTED!`);
                    console.log(`   User: ${user.username} (ID: ${user.id})`);
                    console.log(`   Amount: ${amount} SOL`);
                    console.log(`   From: ${source}`);
                    console.log(`   Tx: ${signature}`);
                    
                    await this.recordDeposit(user.id, 'SOL', amount, signature, source, destination);
                    return true;
                }
            }
        }
        return false;
    }
    
    async recordDeposit(userId, asset, amount, signature, fromAddress, toAddress) {
        const db = new sqlite3.Database(path.join(__dirname, '../../database.sqlite'));
        
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                const depositId = crypto.randomUUID();
                db.run(
                    `INSERT INTO deposits (id, user_id, asset, amount, tx_signature, from_address, to_address, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [depositId, userId, asset, amount, signature, fromAddress, toAddress],
                    (err) => {
                        if (err) {
                            console.error('❌ Error inserting deposit:', err.message);
                            db.run('ROLLBACK');
                            reject(err);
                            return;
                        }
                    }
                );
                
                const balanceColumn = asset === 'SOL' ? 'sol_balance' : 'usdc_balance';
                db.run(
                    `UPDATE users SET ${balanceColumn} = ${balanceColumn} + ? WHERE id = ?`,
                    [amount, userId],
                    (err) => {
                        if (err) {
                            console.error('❌ Error updating balance:', err.message);
                            db.run('ROLLBACK');
                            reject(err);
                            return;
                        }
                    }
                );
                
                const txId = crypto.randomUUID();
                db.run(
                    `INSERT INTO transactions (id, user_id, type, asset, amount, tx_signature, to_address, from_address, created_at)
                     VALUES (?, ?, 'deposit', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [txId, userId, asset, amount, signature, toAddress, fromAddress],
                    (err) => {
                        if (err) {
                            console.error('❌ Error inserting transaction:', err.message);
                            db.run('ROLLBACK');
                            reject(err);
                            return;
                        }
                    }
                );
                
                db.run('COMMIT', (err) => {
                    db.close();
                    if (err) {
                        console.error('❌ Commit error:', err.message);
                        reject(err);
                    } else {
                        console.log(`   ✅ Deposit recorded: +${amount} ${asset} for user ${userId}`);
                        resolve();
                    }
                });
            });
        });
    }
}

module.exports = new DepositMonitor();
