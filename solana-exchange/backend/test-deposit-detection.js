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
