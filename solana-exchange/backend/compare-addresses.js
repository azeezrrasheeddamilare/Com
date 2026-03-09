require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { getHDWallet } = require('./src/lib/hdwallet');

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
const hdWallet = getHDWallet();

// Get master address
const master = hdWallet.deriveUserAddress(0);
console.log(`\n📍 NEW MASTER WALLET: ${master.publicKey}`);
console.log('');

// Get all users
db.all('SELECT id, username, wallet_index, deposit_address FROM users ORDER BY wallet_index', [], (err, users) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    
    console.log('┌──────────┬─────────────┬──────────────────────────────────────────────┐');
    console.log('│ Username │ Wallet Index │ Current Address                              │');
    console.log('├──────────┼─────────────┼──────────────────────────────────────────────┤');
    
    users.forEach(user => {
        console.log(`│ ${user.username.padEnd(8)} │ ${user.wallet_index.toString().padEnd(11)} │ ${user.deposit_address.substring(0, 40)}... │`);
    });
    console.log('└──────────┴─────────────┴──────────────────────────────────────────────┘');
    
    console.log('\n📋 NEW ADDRESSES THAT WILL BE ASSIGNED:');
    console.log('┌──────────┬─────────────┬──────────────────────────────────────────────┐');
    console.log('│ Username │ Wallet Index │ New Address                                  │');
    console.log('├──────────┼─────────────┼──────────────────────────────────────────────┤');
    
    users.forEach(user => {
        const newAddr = hdWallet.deriveUserAddress(user.wallet_index).publicKey;
        console.log(`│ ${user.username.padEnd(8)} │ ${user.wallet_index.toString().padEnd(11)} │ ${newAddr} │`);
    });
    console.log('└──────────┴─────────────┴──────────────────────────────────────────────┘');
    
    db.close();
});
