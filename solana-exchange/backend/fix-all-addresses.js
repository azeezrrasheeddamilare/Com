require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { getHDWallet } = require('./src/lib/hdwallet');

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
const hdWallet = getHDWallet();

console.log('\n🔧 ONE-TIME ADDRESS FIX');
console.log('=======================');

db.all('SELECT id, username, wallet_index, deposit_address FROM users', [], (err, users) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    
    console.log(`Found ${users.length} users\n`);
    
    let fixed = 0;
    let pending = users.length;
    
    users.forEach(user => {
        const correctAddr = hdWallet.deriveUserAddress(user.wallet_index).publicKey;
        
        if (user.deposit_address !== correctAddr) {
            db.run(
                'UPDATE users SET deposit_address = ? WHERE id = ?',
                [correctAddr, user.id],
                (err) => {
                    if (err) {
                        console.error(`❌ Failed to fix ${user.username}:`, err.message);
                    } else {
                        console.log(`✅ Fixed ${user.username}: ${correctAddr}`);
                        fixed++;
                    }
                    
                    pending--;
                    if (pending === 0) {
                        console.log(`\n✅ Fixed ${fixed} addresses`);
                        db.close();
                    }
                }
            );
        } else {
            console.log(`⏭️  ${user.username} already correct`);
            pending--;
            if (pending === 0) {
                console.log(`\n✅ All addresses already correct`);
                db.close();
            }
        }
    });
});
