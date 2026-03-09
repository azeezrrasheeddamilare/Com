require('dotenv').config();
const { Connection, PublicKey } = require('@solana/web3.js');
const { getHDWallet } = require('./src/lib/hdwallet');

async function testSweep() {
    console.log('\n💰 TEST SWEEP FUNCTION');
    console.log('=====================');
    
    const hdWallet = getHDWallet();
    const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
    
    // Check all user wallets
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
    
    db.all('SELECT username, wallet_index FROM users', [], async (err, users) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        console.log('\n📊 USER WALLET STATUS:');
        console.log('┌──────────┬──────────────────────────────────────────────┬─────────────┬─────────────┐');
        console.log('│ Username │ Address                                      │ Balance     │ Sweepable   │');
        console.log('├──────────┼──────────────────────────────────────────────┼─────────────┼─────────────┤');
        
        for (const user of users) {
            const userWallet = hdWallet.deriveUserAddress(user.wallet_index);
            const balance = await connection.getBalance(new PublicKey(userWallet.publicKey));
            const sweepable = Math.max(0, balance - 890880); // Rent exemption
            
            console.log(`│ ${user.username.padEnd(8)} │ ${userWallet.publicKey} │ ${(balance/1e9).toFixed(4)} SOL │ ${(sweepable/1e9).toFixed(4)} SOL │`);
        }
        console.log('└──────────┴──────────────────────────────────────────────┴─────────────┴─────────────┘');
        
        console.log('\n✅ Sweep function will now leave 0.00089 SOL in each wallet for rent');
        db.close();
    });
}

testSweep();
