require('dotenv').config();
const { Connection, PublicKey } = require('@solana/web3.js');
const { getHDWallet } = require('./src/lib/hdwallet');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkWallets() {
    console.log('\n🔍 CHECKING WALLET CONSISTENCY');
    console.log('==============================');
    
    const hdWallet = getHDWallet();
    const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
    
    // Check master wallet
    const master = hdWallet.deriveUserAddress(0);
    const masterBalance = await connection.getBalance(new PublicKey(master.publicKey));
    console.log(`\n📍 MASTER WALLET (index 0):`);
    console.log(`   Address: ${master.publicKey}`);
    console.log(`   Balance: ${masterBalance / 1e9} SOL`);
    
    // Check all users
    const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
    
    db.all('SELECT id, username, wallet_index, deposit_address FROM users ORDER BY wallet_index', [], async (err, users) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        console.log('\n📊 USER WALLETS:');
        console.log('┌──────────┬─────────────┬──────────────────────────────────────────────┬─────────────┬─────────┐');
        console.log('│ Username │ Index       │ Address                                      │ Balance     │ Status  │');
        console.log('├──────────┼─────────────┼──────────────────────────────────────────────┼─────────────┼─────────┤');
        
        let totalBalance = 0;
        
        for (const user of users) {
            const expectedAddr = hdWallet.deriveUserAddress(user.wallet_index).publicKey;
            const matches = user.deposit_address === expectedAddr;
            
            let balance = 0;
            try {
                const addr = new PublicKey(user.deposit_address);
                balance = await connection.getBalance(addr);
                totalBalance += balance;
            } catch (e) {}
            
            const balanceStr = (balance / 1e9).toFixed(4).padStart(10);
            const status = matches ? '✅' : '❌';
            
            console.log(`│ ${user.username.padEnd(8)} │ ${user.wallet_index.toString().padEnd(11)} │ ${user.deposit_address} │ ${balanceStr} SOL │   ${status}  │`);
        }
        console.log('└──────────┴─────────────┴──────────────────────────────────────────────┴─────────────┴─────────┘');
        
        console.log(`\n💰 Total balance in user wallets: ${(totalBalance / 1e9).toFixed(4)} SOL`);
        
        // Check for any old deposits
        console.log('\n📝 Checking for recent deposits...');
        for (const user of users) {
            try {
                const addr = new PublicKey(user.deposit_address);
                const signatures = await connection.getSignaturesForAddress(addr, { limit: 3 });
                if (signatures.length > 0) {
                    console.log(`\n   ${user.username} has ${signatures.length} recent transactions`);
                }
            } catch (e) {}
        }
        
        db.close();
    });
}

checkWallets().catch(console.error);
