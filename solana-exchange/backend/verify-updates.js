require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { getHDWallet } = require('./src/lib/hdwallet');

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
const hdWallet = getHDWallet();

db.all('SELECT username, wallet_index, deposit_address FROM users ORDER BY wallet_index', [], (err, users) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    
    let allMatch = true;
    
    console.log('\n📊 VERIFICATION RESULTS:');
    console.log('┌──────────┬─────────────┬──────────────────────────────────────────────┬─────────┐');
    console.log('│ Username │ Wallet Index │ Current Address                              │ Status  │');
    console.log('├──────────┼─────────────┼──────────────────────────────────────────────┼─────────┤');
    
    users.forEach(user => {
        const expectedAddr = hdWallet.deriveUserAddress(user.wallet_index).publicKey;
        const matches = user.deposit_address === expectedAddr;
        const status = matches ? '✅ OK' : '❌ MISMATCH';
        if (!matches) allMatch = false;
        
        console.log(`│ ${user.username.padEnd(8)} │ ${user.wallet_index.toString().padEnd(11)} │ ${user.deposit_address} │ ${status} │`);
    });
    console.log('└──────────┴─────────────┴──────────────────────────────────────────────┴─────────┘');
    
    if (allMatch) {
        console.log('\n✅✅✅ ALL ADDRESSES VERIFIED! Perfect match! ✅✅✅');
    } else {
        console.log('\n❌ Some addresses don\'t match. Check the database.');
    }
    
    db.close();
});
