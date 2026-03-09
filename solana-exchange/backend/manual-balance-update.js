require('dotenv').config();
const { Connection, PublicKey } = require('@solana/web3.js');
const { getHDWallet } = require('./src/lib/hdwallet');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

async function manualBalanceUpdate() {
    console.log('\n🔄 MANUAL BALANCE UPDATE');
    console.log('========================');
    
    const hdWallet = getHDWallet();
    const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
    const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
    
    // Get all users
    db.all('SELECT id, username, wallet_index, sol_balance, usdc_balance FROM users', [], async (err, users) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        let updated = 0;
        
        for (const user of users) {
            const userWallet = hdWallet.deriveUserAddress(user.wallet_index);
            const blockchainBalance = await connection.getBalance(new PublicKey(userWallet.publicKey));
            const blockchainSOL = blockchainBalance / 1e9;
            
            // Check if balances match
            if (Math.abs((user.sol_balance || 0) - blockchainSOL) > 0.0001) {
                console.log(`\n📝 User ${user.username}:`);
                console.log(`   DB Balance: ${user.sol_balance || 0} SOL`);
                console.log(`   Blockchain: ${blockchainSOL} SOL`);
                console.log(`   Difference: ${blockchainSOL - (user.sol_balance || 0)} SOL`);
                
                // Update database
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE users SET sol_balance = ? WHERE id = ?',
                        [blockchainSOL, user.id],
                        (err) => {
                            if (err) reject(err);
                            else {
                                console.log(`   ✅ Updated to ${blockchainSOL} SOL`);
                                updated++;
                                resolve();
                            }
                        }
                    );
                });
                
                // Create transaction record for missing deposits
                const signatures = await connection.getSignaturesForAddress(
                    new PublicKey(userWallet.publicKey),
                    { limit: 5 }
                );
                
                for (const sig of signatures) {
                    // Check if already in transactions
                    const exists = await new Promise((resolve) => {
                        db.get(
                            'SELECT id FROM transactions WHERE tx_signature = ?',
                            [sig.signature],
                            (err, row) => resolve(!!row)
                        );
                    });
                    
                    if (!exists) {
                        const tx = await connection.getParsedTransaction(sig.signature, {
                            maxSupportedTransactionVersion: 0
                        });
                        
                        if (tx && tx.meta) {
                            let amount = 0;
                            for (const ix of tx.transaction.message.instructions) {
                                if (ix.program === 'system' && ix.parsed?.type === 'transfer') {
                                    const { destination, lamports } = ix.parsed.info;
                                    if (destination === userWallet.publicKey) {
                                        amount = lamports / 1e9;
                                        
                                        db.run(
                                            `INSERT INTO transactions (id, user_id, type, asset, amount, tx_signature, created_at)
                                             VALUES (?, ?, 'deposit', 'SOL', ?, ?, datetime('now', '-1 day'))`,
                                            [crypto.randomUUID(), user.id, amount, sig.signature],
                                            () => {}
                                        );
                                        
                                        console.log(`      📜 Added transaction record for ${amount} SOL`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`\n✅ Updated ${updated} user balances`);
        
        // Show final balances
        db.all('SELECT username, sol_balance FROM users', [], (err, users) => {
            console.log('\n📊 FINAL BALANCES:');
            users.forEach(u => {
                console.log(`   ${u.username}: ${u.sol_balance} SOL`);
            });
            db.close();
        });
    });
}

manualBalanceUpdate();
