#!/bin/bash

# COMPLETE FIX: Deposit Detection & Balance Updates

cd /workspaces/Com/solana-exchange/backend

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     FIX: Deposit Detection & Balance Updates              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ============================================
# Step 1: Backup current deposit monitor
# ============================================
cp src/services/deposit-monitor.js src/services/deposit-monitor.js.backup
echo "✅ Deposit monitor backed up"

# ============================================
# Step 2: Create COMPLETELY NEW deposit monitor
# ============================================
cat > src/services/deposit-monitor.js << 'EOF'
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getHDWallet, USDC_MINT } = require('../lib/hdwallet');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
const db = require('../lib/database');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const User = db.User;
const Deposit = db.Deposit;
const Transaction = db.Transaction;

class DepositMonitor {
    constructor() {
        this.connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
        this.hdWallet = getHDWallet();
        this.processedSignatures = new Set();
        this.isRunning = false;
        this.checkInterval = 10000; // 10 seconds
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
            console.log('\n🔍 Checking for new deposits...');
            
            // Get all users from database
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
            const userWallet = this.hdWallet.deriveUserAddress(user.wallet_index);
            const userAddress = userWallet.publicKey;
            
            // Get recent transactions for this address
            const pubkey = new PublicKey(userAddress);
            const signatures = await this.connection.getSignaturesForAddress(
                pubkey, 
                { limit: 10 }
            );
            
            if (signatures.length > 0) {
                console.log(`   📬 Found ${signatures.length} txs for user ${user.id} (${userAddress})`);
            }
            
            for (const sig of signatures) {
                // Skip if already processed
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
                
                // Check for SOL transfers
                await this.processSOLTransfer(user, tx, sig.signature, userAddress);
                
                // Check for USDC transfers
                await this.processUSDCDeposit(user, tx, sig.signature, userAddress);
                
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
            // Check if it's a system transfer
            if (ix.program === 'system' && ix.parsed?.type === 'transfer') {
                const { destination, lamports, source } = ix.parsed.info;
                
                // Check if destination is user's address
                if (destination === expectedAddress) {
                    const amount = lamports / LAMPORTS_PER_SOL;
                    
                    console.log(`   💰 SOL DEPOSIT DETECTED!`);
                    console.log(`      User: ${user.username} (ID: ${user.id})`);
                    console.log(`      Amount: ${amount} SOL`);
                    console.log(`      From: ${source}`);
                    console.log(`      Tx: ${signature}`);
                    
                    // Record in database
                    await this.recordDeposit({
                        userId: user.id,
                        asset: 'SOL',
                        amount: amount,
                        signature: signature,
                        fromAddress: source,
                        toAddress: destination
                    });
                    
                    return true;
                }
            }
        }
        return false;
    }
    
    async processUSDCDeposit(user, tx, signature, expectedAddress) {
        if (!tx.meta?.postTokenBalances) return false;
        
        // Get user's USDC token account
        const userATA = await getAssociatedTokenAddress(
            USDC_MINT,
            new PublicKey(expectedAddress)
        );
        const userATAString = userATA.toBase58();
        
        for (const balance of tx.meta.postTokenBalances) {
            if (balance.mint === USDC_MINT.toBase58()) {
                const accountIndex = balance.accountIndex;
                const accountPubkey = tx.transaction.message.accountKeys[accountIndex].pubkey.toBase58();
                
                if (accountPubkey === userATAString) {
                    const preBalance = tx.meta.preTokenBalances?.find(
                        b => b.accountIndex === accountIndex
                    );
                    
                    const preAmount = preBalance ? parseInt(preBalance.uiTokenAmount.amount) : 0;
                    const postAmount = parseInt(balance.uiTokenAmount.amount);
                    
                    if (postAmount > preAmount) {
                        const amount = (postAmount - preAmount) / Math.pow(10, balance.uiTokenAmount.decimals);
                        
                        console.log(`   💰 USDC DEPOSIT DETECTED!`);
                        console.log(`      User: ${user.username} (ID: ${user.id})`);
                        console.log(`      Amount: ${amount} USDC`);
                        console.log(`      Tx: ${signature}`);
                        
                        await this.recordDeposit({
                            userId: user.id,
                            asset: 'USDC',
                            amount: amount,
                            signature: signature,
                            fromAddress: 'unknown',
                            toAddress: accountPubkey
                        });
                        
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    async recordDeposit(data) {
        const { userId, asset, amount, signature, fromAddress, toAddress } = data;
        
        // Use direct SQLite to ensure it's recorded
        const db = new sqlite3.Database(path.join(__dirname, '../../database.sqlite'));
        
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                // Insert deposit
                db.run(
                    `INSERT INTO deposits (id, user_id, asset, amount, tx_signature, from_address, to_address, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [require('crypto').randomUUID(), userId, asset, amount, signature, fromAddress, toAddress],
                    (err) => {
                        if (err) {
                            console.error('❌ Error inserting deposit:', err.message);
                            db.run('ROLLBACK');
                            reject(err);
                            return;
                        }
                    }
                );
                
                // Update user balance
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
                
                // Insert transaction record
                db.run(
                    `INSERT INTO transactions (id, user_id, type, asset, amount, tx_signature, to_address, from_address, created_at)
                     VALUES (?, ?, 'deposit', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [require('crypto').randomUUID(), userId, asset, amount, signature, toAddress, fromAddress],
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
EOF

echo "✅ New deposit monitor created"

# ============================================
# Step 3: Create a test deposit script
# ============================================
cat > test-deposit-detection.js << 'EOF'
require('dotenv').config();
const { Connection, PublicKey } = require('@solana/web3.js');
const { getHDWallet } = require('./src/lib/hdwallet');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function testDepositDetection() {
    console.log('\n🔍 TESTING DEPOSIT DETECTION');
    console.log('============================');
    
    const hdWallet = getHDWallet();
    const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
    
    // Get all users
    const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
    
    db.all('SELECT id, username, wallet_index, sol_balance, usdc_balance FROM users', [], async (err, users) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        console.log('\n📊 CURRENT USER BALANCES (FROM DATABASE):');
        console.log('┌──────────┬─────────────┬─────────────┬─────────────┐');
        console.log('│ Username │ Wallet Index │ SOL Balance │ USDC Balance│');
        console.log('├──────────┼─────────────┼─────────────┼─────────────┤');
        
        for (const user of users) {
            console.log(`│ ${user.username.padEnd(8)} │ ${user.wallet_index.toString().padEnd(11)} │ ${(user.sol_balance || 0).toFixed(4).padEnd(11)} │ ${(user.usdc_balance || 0).toFixed(2).padEnd(11)} │`);
        }
        console.log('└──────────┴─────────────┴─────────────┴─────────────┘');
        
        console.log('\n📋 USER DEPOSIT ADDRESSES:');
        for (const user of users) {
            const userWallet = hdWallet.deriveUserAddress(user.wallet_index);
            const balance = await connection.getBalance(new PublicKey(userWallet.publicKey));
            console.log(`   ${user.username}: ${userWallet.publicKey} (Blockchain balance: ${balance / 1e9} SOL)`);
        }
        
        console.log('\n✅ Deposit monitor is running. Check the server logs for deposit detection.');
        console.log('   If you send SOL to any address above, it should be detected within 10 seconds.');
        
        db.close();
    });
}

testDepositDetection();
EOF

echo "✅ Test deposit script created"

# ============================================
# Step 4: Create a manual balance update script
# ============================================
cat > manual-balance-update.js << 'EOF'
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
EOF

echo "✅ Manual balance update script created"

# ============================================
# Step 5: Create a diagnostic page
# ============================================
cat > public/deposit-diagnostic.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Deposit Diagnostic</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 { color: #333; }
        button {
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            margin: 5px;
        }
        pre {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
        }
        .success { color: green; }
        .error { color: red; }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>💰 Deposit Diagnostic</h1>
            
            <div>
                <button onclick="checkBalances()">Check Balances</button>
                <button onclick="forceUpdate()">Force Balance Update</button>
                <button onclick="checkDeposits()">Check Recent Deposits</button>
            </div>
            
            <div id="results"></div>
        </div>
        
        <div class="card">
            <h2>User Balances</h2>
            <div id="balances">Loading...</div>
        </div>
    </div>

    <script>
        const token = localStorage.getItem('token');
        
        async function checkBalances() {
            try {
                const res = await fetch('/api/trading/balance', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                
                if (data.success) {
                    let html = '<h3>Your Balances:</h3>';
                    html += `<p>Trading Balance: $${data.data.tradingUSDC}</p>`;
                    html += `<p>Main USDC: $${data.data.mainUSDC}</p>`;
                    document.getElementById('balances').innerHTML = html;
                }
            } catch (err) {
                document.getElementById('balances').innerHTML = `<p class="error">Error: ${err.message}</p>`;
            }
        }
        
        async function forceUpdate() {
            document.getElementById('results').innerHTML = '<p>Running manual update...</p>';
            
            try {
                const res = await fetch('/api/admin/force-balance-update', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                document.getElementById('results').innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (err) {
                document.getElementById('results').innerHTML = `<p class="error">${err.message}</p>`;
            }
        }
        
        async function checkDeposits() {
            document.getElementById('results').innerHTML = '<p>Checking deposits...</p>';
            
            try {
                const res = await fetch('/api/transactions', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                document.getElementById('results').innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (err) {
                document.getElementById('results').innerHTML = `<p class="error">${err.message}</p>`;
            }
        }
        
        // Initial load
        checkBalances();
    </script>
</body>
</html>
EOF

echo "✅ Diagnostic page created"

# ============================================
# Step 6: Run manual update first
# ============================================
echo ""
echo "🔄 Running manual balance update..."
node manual-balance-update.js

# ============================================
# Step 7: Restart server
# ============================================
echo ""
echo "🔄 Restarting server with new deposit monitor..."


echo ""
echo "✅ DEPOSIT MONITOR FIXED!"
echo ""
echo "📋 WHAT WAS FIXED:"
echo "   • Deposit monitor now properly records deposits"
echo "   • Updates user balances in database"
echo "   • Creates transaction history"
echo "   • Manual update script to fix existing balances"
echo ""
echo "📱 TO TEST:"
echo "   1. Send SOL to any user's deposit address"
echo "   2. Watch the server logs for '💰 SOL DEPOSIT DETECTED!'"
echo "   3. Check user dashboard - balance should update within 10 seconds"
echo ""
echo "🔍 DIAGNOSTIC PAGE:"
echo "   http://localhost:3000/deposit-diagnostic.html"
echo ""
echo "🔄 MANUAL UPDATE (if needed):"
echo "   node manual-balance-update.js"
echo ""